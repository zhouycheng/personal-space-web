import * as THREE from 'three';

export type SceneDebugGroup = 'workspace' | 'canopy' | 'dressing' | 'leisure' | 'environment';

type Sample = { time:number; cpu:number; update:number; calls:number; triangles:number; shadows:boolean };
type SceneDetails = {
  active:boolean; zoom:number; angle:number; elevation:number; camera:[number,number,number];
  ocean:boolean; steam:boolean; lightweight:boolean; reducedMotion:boolean; journal:boolean; transition:boolean;
  axes:boolean; wireframe:boolean; renderRatio:number; debugTimeHour:number|null;
  groups:Record<SceneDebugGroup,boolean>;
};
type Snapshot = SceneDetails & {
  dpr:number; size:[number,number]; viewport:[number,number]; renderer:string; webgl2:boolean; contextLost:boolean;
  maxTextureSize:number; calls:number; triangles:number; geometries:number; textures:number; programs:number;
  shadowEnabled:boolean; shadowLights:string[]; leafLevels:number[]; leafMeshes:number; errors:string[];
  platform:string; cores:number; memory:number|undefined;
};
type View = { zoom:number; angle:number; elevation:number };
type Controls = {
  setView(view:View):void; resetView():void;
  setGroupVisible(group:SceneDebugGroup,visible:boolean):void;
  setAxes(visible:boolean):void; setWireframe(enabled:boolean):void; setShadows(enabled:boolean):void;
  setRenderRatio(value:number):void; resetRenderRatio():void; setDebugTime(hour:number|null):void;
};

const HOT_CORNER_SIZE=56,WINDOW_MS=5000;
const PANEL_SIZE_KEY='justinspace.scene-debug-panel-size.v1';
const GROUP_LABELS:Record<SceneDebugGroup,string>={
  workspace:'工作区与设备',canopy:'遮阳棚',dressing:'岛屿装饰',leisure:'休闲设施',environment:'海岛地形与天空',
};
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function formatMs(value:number){return `${value.toFixed(1)} 毫秒`;}
function formatQuantiles(values:number[]){
  if(!values.length)return '暂无样本';
  return `P50 ${formatMs(quantile(values,.5))} / P95 ${formatMs(quantile(values,.95))}`;
}
function quantile(values:number[],p:number){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
}
function formatClock(hour:number){
  const hours=Math.floor(hour),minutes=Math.round((hour-hours)*60);
  return `${String(hours%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
function formatDegrees(radians:number){return ((Math.round(radians*180/Math.PI+180)+360)%360)-180;}

export function createScenePerformanceOverlay(options:{
  canvas:HTMLCanvasElement; renderer:THREE.WebGLRenderer; scene:THREE.Scene; camera:THREE.PerspectiveCamera;
  details:()=>SceneDetails; controls:Controls;
}){
  const {canvas,renderer,scene,controls}=options;
  const pinned=import.meta.env.DEV&&import.meta.env.PUBLIC_SCENE_DEBUG_PANEL?.trim().toLowerCase()==='true';
  const mac=/Macintosh|Mac OS X|iPhone|iPad/.test(navigator.userAgent);
  const platform=/Macintosh|Mac OS X/.test(navigator.userAgent)?'macOS':/iPhone|iPad/.test(navigator.userAgent)?'iOS / iPadOS':/Windows/.test(navigator.userAgent)?'Windows':/Android/.test(navigator.userAgent)?'Android':/Linux/.test(navigator.userAgent)?'Linux':'未知';
  const navigatorDetails=navigator as Navigator&{deviceMemory?:number};
  let visible=false,armed=false,insideCorner=false,observer:PerformanceObserver|undefined,timer=0;
  let pendingInputTime:number|undefined;
  const frames:Sample[]=[],inputLatency:number[]=[],longTasks:number[]=[],errors:string[]=[];
  const shadowLights:string[]=[],leafMeshes:THREE.Mesh[]=[];
  scene.traverse(object=>{
    if(object instanceof THREE.Mesh&&object.name==='plant-leaves')leafMeshes.push(object);
    const light=object as THREE.Object3D&{isLight?:boolean;castShadow?:boolean;shadow?:{mapSize:THREE.Vector2}};
    if(light.isLight&&light.castShadow&&light.shadow){
      const names:Record<string,string>={DirectionalLight:'平行光',SpotLight:'聚光灯',PointLight:'点光源'};
      shadowLights.push(`${names[object.type]??'灯光'} ${light.shadow.mapSize.x}×${light.shadow.mapSize.y}`);
    }
  });

  const root=document.createElement('section');
  root.dataset.scenePerformanceOverlay='';
  root.setAttribute('role','region');root.setAttribute('aria-label','全局场景调试面板');root.setAttribute('aria-live','off');
  root.style.cssText='position:fixed;z-index:2147483000;left:12px;bottom:12px;width:480px;height:600px;min-width:min(280px,calc(100vw - 24px));min-height:min(220px,calc(100vh - 24px));max-width:calc(100vw - 24px);max-height:min(82vh,900px);display:none;flex-direction:column;box-sizing:border-box;overflow:hidden;resize:both;padding:0;color:#d8f3dc;background:rgba(9,17,20,.94);border:1px solid rgba(151,198,156,.48);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.34);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;color-scheme:dark;';
  const style=document.createElement('style');
  style.textContent=`
    [data-scene-performance-overlay] *{box-sizing:border-box}
    [data-scene-performance-overlay] [data-panel-header]{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 12px 8px;border-bottom:1px solid rgba(151,198,156,.3);flex:none}
    [data-scene-performance-overlay] [data-panel-title]{color:#f4fff4;font-size:13px;font-weight:700}
    [data-scene-performance-overlay] [data-panel-hint]{display:block;margin-top:2px;color:#a8bcae;font-size:10px;line-height:1.35}
    [data-scene-performance-overlay] [data-panel-close]{flex:none;width:24px;height:24px;padding:0;border:0;background:transparent;color:#d8f3dc;font:20px/22px ui-sans-serif,system-ui,sans-serif;cursor:pointer}
    [data-scene-performance-overlay] [data-panel-close]:hover{background:rgba(151,198,156,.14);border-radius:4px}
    [data-scene-performance-overlay] [data-panel-scroll]{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:9px 12px 14px;scrollbar-color:rgba(151,198,156,.5) rgba(9,17,20,.5);scrollbar-width:thin}
    [data-scene-performance-overlay] [data-readout]{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-variant-numeric:tabular-nums;color:inherit}
    [data-scene-performance-overlay] [data-quick-title]{margin:2px 0 5px;color:#a8bcae}
    [data-scene-performance-overlay] [data-quick-actions]{display:flex;flex-wrap:wrap;gap:5px}
    [data-scene-performance-overlay] hr{height:0;margin:10px 0;border:0;border-top:1px solid rgba(151,198,156,.3)}
    [data-scene-performance-overlay] details{margin:8px 0}
    [data-scene-performance-overlay] summary{color:#e6f6e8;font-weight:700;cursor:pointer;user-select:none}
    [data-scene-performance-overlay] [data-controls]{display:grid;gap:4px;padding:7px 0 0}
    [data-scene-performance-overlay] [data-toggle-row]{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:24px}
    [data-scene-performance-overlay] [data-range-row]{display:grid;grid-template-columns:minmax(110px,1fr) minmax(100px,1.2fr) 72px;align-items:center;gap:8px;min-height:25px}
    [data-scene-performance-overlay] input[type=range]{width:100%;margin:0;accent-color:#b5edc7}
    [data-scene-performance-overlay] [data-range-value]{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    [data-scene-performance-overlay] input[type=checkbox]{width:15px;height:15px;margin:0;accent-color:#b5edc7}
    [data-scene-performance-overlay] button{justify-self:start;padding:3px 7px;border:1px solid rgba(151,198,156,.35);border-radius:4px;background:transparent;color:#d8f3dc;font:inherit;cursor:pointer}
    [data-scene-performance-overlay] button:hover{background:rgba(151,198,156,.1)}
    [data-scene-performance-overlay] :focus-visible{outline:2px solid #b5edc7;outline-offset:2px}
    [data-scene-performance-overlay] [data-note]{margin:3px 0;color:#a8bcae;font-size:10px}
    @media(max-width:520px){[data-scene-performance-overlay] [data-range-row]{grid-template-columns:85px minmax(60px,1fr) 68px;gap:6px}}
  `;
  const header=document.createElement('header');header.dataset.panelHeader='';
  const titleBlock=document.createElement('div');
  const title=document.createElement('span');title.dataset.panelTitle='';title.textContent='场景调试';
  const hint=document.createElement('span');hint.dataset.panelHint='';
  hint.textContent=pinned?'开发常驻模式':`${mac?'⌘':'Ctrl'}+Shift + 左下角 56 像素触发 · 移出面板自动收起`;
  titleBlock.append(title,hint);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.dataset.panelClose='';closeButton.textContent='×';closeButton.title='手动关闭';closeButton.setAttribute('aria-label','手动关闭场景调试面板');closeButton.hidden=pinned;
  header.append(titleBlock,closeButton);
  const body=document.createElement('div');body.dataset.panelScroll='';
  const readout=document.createElement('pre');readout.dataset.readout='';readout.textContent='等待场景数据…';
  const quickTitle=document.createElement('div');quickTitle.dataset.quickTitle='';quickTitle.textContent='快捷调试';
  const quickActions=document.createElement('div');quickActions.dataset.quickActions='';
  body.append(quickTitle,quickActions);
  root.append(style,header,body);document.body.append(root);

  function divider(){body.append(document.createElement('hr'));}
  function controlsSection(label:string){
    const details=document.createElement('details');
    const summary=document.createElement('summary');summary.textContent=label;
    const list=document.createElement('div');list.dataset.controls='';details.append(summary,list);body.append(details);return list;
  }
  function note(parent:HTMLElement,text:string){const item=document.createElement('div');item.dataset.note='';item.textContent=text;parent.append(item);}
  function addButton(parent:HTMLElement,label:string,action:()=>void){
    const control=document.createElement('button');control.type='button';control.textContent=label;control.addEventListener('click',action);parent.append(control);return control;
  }
  function addToggle(parent:HTMLElement,label:string,value:boolean,change:(value:boolean)=>void){
    const line=document.createElement('label');line.dataset.toggleRow='';line.append(document.createTextNode(label));
    const input=document.createElement('input');input.type='checkbox';input.checked=value;input.setAttribute('aria-label',label);
    input.addEventListener('change',()=>change(input.checked));line.append(input);parent.append(line);return input;
  }
  function addRange(parent:HTMLElement,label:string,min:number,max:number,step:number,value:number,format:(value:number)=>string,change:(value:number)=>void){
    const line=document.createElement('label');line.dataset.rangeRow='';line.append(document.createTextNode(label));
    const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);input.setAttribute('aria-label',label);
    const output=document.createElement('output');output.dataset.rangeValue='';output.textContent=format(value);
    input.addEventListener('input',()=>{const next=Number(input.value);output.textContent=format(next);change(next);});
    line.append(input,output);parent.append(line);
    return {input,set(value:number){if(document.activeElement!==input)input.value=String(clamp(value,min,max));output.textContent=format(Number(input.value));},disable(value:boolean){input.disabled=value;}};
  }

  addButton(quickActions,'白天 12:00',()=>controls.setDebugTime(12));
  addButton(quickActions,'黄昏 18:00',()=>controls.setDebugTime(18));
  addButton(quickActions,'夜景 22:00',()=>controls.setDebugTime(22));
  addButton(quickActions,'真实时间',()=>controls.setDebugTime(null));
  const quickWireframe=addButton(quickActions,'线框：关',()=>controls.setWireframe(!options.details().wireframe));
  const quickAxes=addButton(quickActions,'坐标轴：关',()=>controls.setAxes(!options.details().axes));
  const quickShadows=addButton(quickActions,'阴影：开',()=>controls.setShadows(!renderer.shadowMap.enabled));
  const quickEnvironment=addButton(quickActions,'海岛环境：显示',()=>controls.setGroupVisible('environment',!options.details().groups.environment));
  addButton(quickActions,'恢复默认场景',()=>{
    (Object.keys(GROUP_LABELS) as SceneDebugGroup[]).forEach(group=>controls.setGroupVisible(group,true));
    controls.setAxes(false);controls.setWireframe(false);controls.setShadows(!options.details().lightweight);
    controls.resetRenderRatio();controls.resetView();controls.setDebugTime(null);
  });
  divider();
  body.append(readout);

  const sceneControls=controlsSection('全局场景控制');
  const groupInputs={} as Record<SceneDebugGroup,HTMLInputElement>;
  (Object.keys(GROUP_LABELS) as SceneDebugGroup[]).forEach(key=>{groupInputs[key]=addToggle(sceneControls,GROUP_LABELS[key],true,value=>controls.setGroupVisible(key,value));});
  const axesInput=addToggle(sceneControls,'坐标轴',false,value=>controls.setAxes(value));
  const wireframeInput=addToggle(sceneControls,'线框显示',false,value=>controls.setWireframe(value));
  const shadowsInput=addToggle(sceneControls,'阴影渲染',renderer.shadowMap.enabled,value=>controls.setShadows(value));
  note(sceneControls,'显隐、线框和阴影只影响当前场景实例。');
  divider();

  const cameraControls=controlsSection('镜头');
  const cameraZoom=addRange(cameraControls,'缩放',.85,2.2,.01,1,value=>`${value.toFixed(2)}×`,()=>{});
  const cameraYaw=addRange(cameraControls,'水平角',-180,180,1,0,value=>`${Math.round(value)}°`,()=>{});
  const cameraPitch=addRange(cameraControls,'俯仰角',11.5,57.3,1,20,value=>`${Math.round(value)}°`,()=>{});
  const viewInputs=[cameraZoom,cameraYaw,cameraPitch];
  const syncView=()=>controls.setView({zoom:Number(cameraZoom.input.value),angle:Number(cameraYaw.input.value)*Math.PI/180,elevation:Number(cameraPitch.input.value)*Math.PI/180});
  viewInputs.forEach(control=>control.input.addEventListener('input',syncView));
  addButton(cameraControls,'恢复默认镜头',()=>controls.resetView());
  note(cameraControls,'场景暂停、日记打开或镜头过场期间不可调节。');
  divider();

  const renderControls=controlsSection('光照与分辨率');
  const currentHour=()=>{const now=new Date();return now.getHours()+now.getMinutes()/60;};
  const timeSlider=addRange(renderControls,'测试时刻',0,23.75,.25,currentHour(),value=>`${formatClock(value)} · 调试`,value=>controls.setDebugTime(value));
  addButton(renderControls,'恢复真实时间',()=>controls.setDebugTime(null));
  const renderRatio=addRange(renderControls,'渲染比例 DPR',.5,2,.05,renderer.getPixelRatio(),value=>`${value.toFixed(2)}×`,value=>controls.setRenderRatio(value));
  addButton(renderControls,'恢复默认渲染比例',()=>controls.resetRenderRatio());
  divider();

  const sizeControls=controlsSection('面板尺寸');
  function readPanelSize(){
    try{
      const saved=JSON.parse(localStorage.getItem(PANEL_SIZE_KEY)??'null') as {width?:unknown;height?:unknown}|null;
      if(saved&&typeof saved.width==='number'&&typeof saved.height==='number')return {width:clamp(saved.width,280,800),height:clamp(saved.height,220,860)};
    }catch{/* Storage may be unavailable; use the defaults. */}
    return {width:480,height:600};
  }
  function savePanelSize(width:number,height:number){try{localStorage.setItem(PANEL_SIZE_KEY,JSON.stringify({width:Math.round(width),height:Math.round(height)}));}catch{/* Resizing still works until the page closes. */}}
  const preferred=readPanelSize();root.style.width=`${preferred.width}px`;root.style.height=`${preferred.height}px`;
  let widthSlider:ReturnType<typeof addRange>,heightSlider:ReturnType<typeof addRange>;
  function setPanelDimension(axis:'width'|'height',value:number){
    const rect=root.getBoundingClientRect();
    const minWidth=Math.min(280,Math.max(160,innerWidth-24)),maxWidth=Math.max(minWidth,Math.min(800,innerWidth-24));
    const minHeight=Math.min(220,Math.max(160,innerHeight-24)),maxHeight=Math.max(minHeight,Math.min(860,innerHeight-24));
    const width=axis==='width'?clamp(value,minWidth,maxWidth):rect.width;
    const height=axis==='height'?clamp(value,minHeight,maxHeight):rect.height;
    root.style.width=`${width}px`;root.style.height=`${height}px`;savePanelSize(width,height);widthSlider?.set(width);heightSlider?.set(height);
  }
  widthSlider=addRange(sizeControls,'宽度',280,800,10,preferred.width,value=>`${Math.round(value)} 像素`,value=>setPanelDimension('width',value));
  heightSlider=addRange(sizeControls,'高度',220,860,10,preferred.height,value=>`${Math.round(value)} 像素`,value=>setPanelDimension('height',value));
  addButton(sizeControls,'恢复默认尺寸',()=>{root.style.width='480px';root.style.height='600px';savePanelSize(480,600);widthSlider.set(480);heightSlider.set(600);});
  note(sizeControls,'也可拖动面板右下角；内容区域单独滚动。');
  const resizeObserver=new ResizeObserver(()=>{
    if(!visible)return;
    const rect=root.getBoundingClientRect();if(rect.width<160||rect.height<160)return;
    savePanelSize(rect.width,rect.height);widthSlider.set(rect.width);heightSlider.set(rect.height);
  });
  resizeObserver.observe(root);

  function captureRenderer():Snapshot{
    const gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER)??'未知').replace(/,\s*Unspecified Version\b/i,'');
    const leafLevels=[0,0,0,0];
    for(const mesh of leafMeshes){const level=mesh.userData.detailLevel;if(Number.isInteger(level)&&level>=0&&level<leafLevels.length)leafLevels[level]++;}
    const rect=canvas.getBoundingClientRect();
    return {...options.details(),dpr:window.devicePixelRatio||1,size:[canvas.width,canvas.height],viewport:[Math.round(rect.width),Math.round(rect.height)],renderer:rendererName,
      webgl2:renderer.capabilities.isWebGL2,contextLost:gl.isContextLost(),maxTextureSize:renderer.capabilities.maxTextureSize,
      calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,
      textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,shadowEnabled:renderer.shadowMap.enabled,
      shadowLights,leafLevels,leafMeshes:leafMeshes.length,errors:[...errors],platform,cores:navigator.hardwareConcurrency??0,memory:navigatorDetails.deviceMemory};
  }
  function update(){
    const now=performance.now();while(frames.length&&now-frames[0].time>WINDOW_MS)frames.shift();
    while(longTasks.length&&now-longTasks[0]>WINDOW_MS)longTasks.shift();
    while(inputLatency.length>120)inputLatency.shift();
    const gaps=frames.slice(1).map((sample,index)=>sample.time-frames[index].time).filter(gap=>gap<=WINDOW_MS);
    const cpus=frames.map(sample=>sample.cpu),updates=frames.map(sample=>sample.update),recent=frames.filter(sample=>now-sample.time<=1000);
    const fps=recent.length>1?(recent.length-1)*1000/(recent.at(-1)!.time-recent[0].time):0;
    const latest=frames.at(-1),snapshot=captureRenderer();
    const gapSummary=gaps.length?`P50 ${formatMs(quantile(gaps,.5))} / P95 ${formatMs(quantile(gaps,.95))} / 最大 ${formatMs(quantile(gaps,1))}`:'暂无活动帧';
    const longGaps=gaps.filter(gap=>gap>50).length,veryLongGaps=gaps.filter(gap=>gap>100).length;
    const position=snapshot.camera.map(value=>value.toFixed(2)).join(', ');
    const renderRatioX=snapshot.viewport[0]?snapshot.size[0]/snapshot.viewport[0]:0;
    const renderRatioY=snapshot.viewport[1]?snapshot.size[1]/snapshot.viewport[1]:0;
    const hour=snapshot.debugTimeHour??currentHour();
    const errorsText=snapshot.errors.length?snapshot.errors.slice(-8).map(error=>error.replace(/\s+/g,' ').slice(0,180)).join('\n  '):'无';
    readout.textContent=[
      '性能（近 5 秒采样）',
      `FPS：${fps.toFixed(1)}（场景绘制提交）`,
      `帧间隔：${gapSummary}`,
      `慢帧：>${50} 毫秒 ${longGaps} 次 / >${100} 毫秒 ${veryLongGaps} 次`,
      `CPU 场景更新：${formatQuantiles(updates)}`,
      `CPU WebGL 提交：${formatQuantiles(cpus)}`,
      `相机输入到绘制：${formatQuantiles(inputLatency)}`,
      `浏览器长任务（>${50} 毫秒）：${longTasks.length} 次`,
      '',
      '────────────────────────────────',
      '渲染与分辨率',
      `绘制调用：${latest?.calls??snapshot.calls} · 三角形：${((latest?.triangles??snapshot.triangles)/1e6).toFixed(2)} 百万 · 着色器程序：${snapshot.programs}`,
      `阴影刷新：${frames.filter(frame=>frame.shadows).length} / ${frames.length} 帧 · 阴影渲染：${snapshot.shadowEnabled?'开':'关'}`,
      `视口：${snapshot.viewport[0]} × ${snapshot.viewport[1]} CSS 像素 · 缓冲区：${snapshot.size[0]} × ${snapshot.size[1]} 像素`,
      `设备 DPR：${snapshot.dpr.toFixed(2)}× · 渲染 DPR：${snapshot.renderRatio.toFixed(2)}× · 实际横纵比：${renderRatioX.toFixed(2)}× / ${renderRatioY.toFixed(2)}×`,
      `WebGL：${snapshot.webgl2?'2':'1'} · 上下文：${snapshot.contextLost?'丢失':'正常'} · 最大纹理：${snapshot.maxTextureSize} 像素`,
      `GPU：${snapshot.renderer}`,
      `设备：${snapshot.platform} · 并发 ${snapshot.cores} 核 · 内存 ${snapshot.memory===undefined?'未提供':`${snapshot.memory} GB`}`,
      `植被 LOD：${snapshot.leafLevels.join(' / ')}（${snapshot.leafMeshes} 组）· 资源：${snapshot.geometries} 个几何体 / ${snapshot.textures} 个纹理`,
      '',
      '────────────────────────────────',
      '场景状态',
      `渲染：${snapshot.active?'活动':'暂停'} · 过场：${snapshot.transition?'进行中':'无'} · 日记：${snapshot.journal?'打开':'关闭'}`,
      `海面：${snapshot.ocean?'活动':'暂停'} · 蒸汽：${snapshot.steam?'活动':'暂停'} · 模式：${snapshot.lightweight?'轻量':'完整'} / ${snapshot.reducedMotion?'减少动态':'正常动态'}`,
      `镜头：缩放 ${snapshot.zoom.toFixed(3)}× · 水平 ${formatDegrees(snapshot.angle)}° · 俯仰 ${(snapshot.elevation*180/Math.PI).toFixed(1)}° · 坐标 ${position}`,
      `投影灯光：${snapshot.shadowLights.join('、')||'无'}`,
      `测试时刻：${snapshot.debugTimeHour===null?'跟随真实时间':`${formatClock(hour)}（覆盖）`}`,
      '',
      '────────────────────────────────',
      '运行时错误',
      `  ${errorsText}`,
      '',
      '说明：静止时场景按需绘制，FPS 会降至 0；它不是屏幕刷新率。WebGL 不提供 GPU 执行耗时，CPU WebGL 提交不代表 GPU 耗时。',
    ].join('\n');

    axesInput.checked=snapshot.axes;wireframeInput.checked=snapshot.wireframe;shadowsInput.checked=snapshot.shadowEnabled;
    quickWireframe.textContent=`线框：${snapshot.wireframe?'开':'关'}`;
    quickAxes.textContent=`坐标轴：${snapshot.axes?'开':'关'}`;
    quickShadows.textContent=`阴影：${snapshot.shadowEnabled?'开':'关'}`;
    quickEnvironment.textContent=`海岛环境：${snapshot.groups.environment?'显示':'隐藏'}`;
    for(const group of Object.keys(GROUP_LABELS) as SceneDebugGroup[])groupInputs[group].checked=snapshot.groups[group];
    const cameraDisabled=!snapshot.active||snapshot.transition||snapshot.journal;
    viewInputs.forEach(control=>control.disable(cameraDisabled));
    cameraZoom.set(snapshot.zoom);cameraYaw.set(formatDegrees(snapshot.angle));cameraPitch.set(snapshot.elevation*180/Math.PI);
    renderRatio.set(snapshot.renderRatio);timeSlider.set(hour);
    timeSlider.input.title=snapshot.debugTimeHour===null?'跟随真实时间':'调试覆盖时间';
  }
  function startObservers(){
    if(timer)return;
    if('PerformanceObserver'in window){
      try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.startTime);});observer.observe({type:'longtask',buffered:true});}
      catch{observer?.disconnect();observer=undefined;}
    }
    update();timer=window.setInterval(update,500);
  }
  function stopObservers(){
    window.clearInterval(timer);timer=0;observer?.disconnect();observer=undefined;
    frames.length=0;inputLatency.length=0;longTasks.length=0;pendingInputTime=undefined;
  }
  function show(value:boolean){
    if(pinned&&!value)return;
    if(visible===value)return;
    visible=value;root.hidden=!visible;root.style.display=visible?'flex':'none';
    if(visible)startObservers();else stopObservers();
  }
  function modifierChord(event:KeyboardEvent){return event.shiftKey&&(mac?event.metaKey:event.ctrlKey);}
  const chordDown={mac:false,other:false};
  function trigger(){
    const matches=insideCorner&&(mac?chordDown.mac:chordDown.other);
    if(!matches){armed=false;return;}
    if(!armed){armed=true;show(true);}
  }
  const onPointerMove=(event:PointerEvent)=>{
    insideCorner=event.clientX<=HOT_CORNER_SIZE&&event.clientY>=innerHeight-HOT_CORNER_SIZE;
    if(visible&&!pinned&&event.pointerType!=='touch'&&!root.contains(document.elementFromPoint(event.clientX,event.clientY)))show(false);
    trigger();
  };
  const onKeyDown=(event:KeyboardEvent)=>{
    const down=modifierChord(event);if(mac)chordDown.mac=down;else chordDown.other=down;
    if(event.key==='Escape'&&visible&&!pinned){show(false);return;}
    trigger();
  };
  const onKeyUp=(event:KeyboardEvent)=>{const down=modifierChord(event);if(mac)chordDown.mac=down;else chordDown.other=down;trigger();};
  const onBlur=()=>{insideCorner=false;chordDown.mac=chordDown.other=false;armed=false;if(!pinned)show(false);};
  const onPanelLeave=()=>{if(!pinned)show(false);};
  const onError=(event:ErrorEvent)=>{errors.push((event.message||'运行时错误').slice(0,180));if(errors.length>12)errors.shift();};
  const onRejection=(event:PromiseRejectionEvent)=>{errors.push(String(event.reason??'未处理的 Promise 错误').slice(0,180));if(errors.length>12)errors.shift();};
  closeButton.addEventListener('click',()=>show(false));root.addEventListener('pointerleave',onPanelLeave);
  window.addEventListener('pointermove',onPointerMove,{passive:true});
  window.addEventListener('keydown',onKeyDown,{passive:true});window.addEventListener('keyup',onKeyUp,{passive:true});
  window.addEventListener('blur',onBlur);window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  show(pinned);
  return {
    record(time:number,cpu:number,update:number,calls:number,triangles:number,shadows:boolean){
      if(!visible)return;
      const sample={time,cpu,update,calls,triangles,shadows};
      frames.push(sample);
      while(frames.length>1800)frames.shift();
      if(pendingInputTime!==undefined){inputLatency.push(performance.now()-pendingInputTime);pendingInputTime=undefined;}
    },
    recordInput(time:number){if(visible)pendingInputTime=time;},
    dispose(){
      stopObservers();resizeObserver.disconnect();root.removeEventListener('pointerleave',onPanelLeave);
      window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);
      window.removeEventListener('blur',onBlur);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);root.remove();
    },
  };
}
