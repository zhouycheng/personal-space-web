import * as THREE from 'three';

type Sample = { time:number; cpu:number; update:number; calls:number; triangles:number; shadows:boolean };
type SceneDetails = {
  active:boolean; zoom:number; angle:number; elevation:number; camera:[number,number,number];
  ocean:boolean; steam:boolean; lightweight:boolean; reducedMotion:boolean; journal:boolean; transition:boolean;
};
type Snapshot = SceneDetails & {
  dpr:number; size:[number,number]; viewport:[number,number]; renderer:string; webgl2:boolean; contextLost:boolean;
  maxTextureSize:number; calls:number; triangles:number; geometries:number; textures:number; programs:number;
  shadowEnabled:boolean; shadowLights:string[]; leafLevels:number[]; leafMeshes:number; errors:string[];
  platform:string; cores:number; memory:number|undefined;
};

// Keep the overlay hidden by default in development and production builds.
const ALWAYS_VISIBLE_IN_DEV = false;
const HOT_CORNER_SIZE = 56;
const WINDOW_MS = 5000;
const MAX_FRAME_GAP_SAMPLE_MS = 250;

export function createScenePerformanceOverlay(options:{canvas:HTMLCanvasElement;renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;details:()=>SceneDetails}) {
  const {canvas,renderer,scene}=options;
  const pinned=import.meta.env.DEV&&ALWAYS_VISIBLE_IN_DEV;
  const userAgent=navigator.userAgent;
  const mac=/Macintosh|Mac OS X/.test(userAgent);
  const platform=/Macintosh|Mac OS X/.test(userAgent)?'macOS':/iPhone|iPad/.test(userAgent)?'iOS/iPadOS':/Windows/.test(userAgent)?'Windows':/Android/.test(userAgent)?'Android':/Linux/.test(userAgent)?'Linux':'unknown';
  const navigatorDetails=navigator as Navigator&{deviceMemory?:number};
  let visible:boolean=pinned,armed=false,insideCorner=false,observer:PerformanceObserver|undefined,timer=0;
  let chordDown=false,lastFrameTime:number|undefined,pendingInputTime:number|undefined;
  const frames:Sample[]=[],inputLatency:number[]=[],longTasks:number[]=[],errors:string[]=[];
  const shadowLights:string[]=[],leafMeshes:THREE.Mesh[]=[];
  scene.traverse(object=>{
    if(object instanceof THREE.Mesh&&object.name==='plant-leaves')leafMeshes.push(object);
    const light=object as THREE.Object3D&{isLight?:boolean;castShadow?:boolean;shadow?:{mapSize:THREE.Vector2}};
    if(light.isLight&&light.castShadow&&light.shadow)shadowLights.push(`${object.type} ${light.shadow.mapSize.x}×${light.shadow.mapSize.y}`);
  });
  const root=document.createElement('section');
  root.dataset.scenePerformanceOverlay='';
  root.setAttribute('role','status');root.setAttribute('aria-label','场景帧率调试信息');root.setAttribute('aria-live','off');
  root.style.cssText='position:fixed;z-index:2147483000;left:12px;bottom:12px;width:min(420px,calc(100vw - 24px));max-height:min(62vh,620px);overflow:auto;box-sizing:border-box;padding:12px 14px;color:#d8f3dc;background:rgba(9,17,20,.94);border:1px solid rgba(151,198,156,.48);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.34);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;';
  const heading=document.createElement('div');
  heading.style.cssText='display:flex;justify-content:space-between;gap:12px;padding-bottom:7px;margin-bottom:7px;border-bottom:1px solid rgba(151,198,156,.3);font-weight:700;color:#f4fff4;';
  const title=document.createElement('span');title.textContent='SCENE PERFORMANCE';
  heading.append(title);
  const content=document.createElement('pre');
  content.style.cssText='margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:inherit;';
  root.append(heading,content);root.hidden=true;document.body.append(root);

  function captureRenderer():Snapshot {
    const gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName=String(gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER)??'unknown');
    const leafLevels=[0,0,0,0];
    for(const mesh of leafMeshes){const level=mesh.userData.detailLevel;if(Number.isInteger(level)&&level>=0&&level<leafLevels.length)leafLevels[level]++;}
    const rect=canvas.getBoundingClientRect();
    return {...options.details(),dpr:renderer.getPixelRatio(),size:[canvas.width,canvas.height],viewport:[Math.round(rect.width),Math.round(rect.height)],renderer:rendererName,
      webgl2:renderer.capabilities.isWebGL2,contextLost:gl.isContextLost(),maxTextureSize:renderer.capabilities.maxTextureSize,
      calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
      geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
      programs:renderer.info.programs?.length??0,shadowEnabled:renderer.shadowMap.enabled,
      shadowLights,leafLevels,leafMeshes:leafMeshes.length,errors:[...errors],
      platform,cores:navigator.hardwareConcurrency??0,memory:navigatorDetails.deviceMemory};
  }
  const quantile=(values:number[],p:number)=>{if(!values.length)return 0;values.sort((a,b)=>a-b);return values[Math.min(values.length-1,Math.floor((values.length-1)*p))];};
  function update() {
    const now=performance.now();while(frames.length&&now-frames[0].time>WINDOW_MS)frames.shift();
    while(longTasks.length&&now-longTasks[0]>WINDOW_MS)longTasks.shift();
    while(inputLatency.length>120)inputLatency.shift();
    const gaps=frames.slice(1).map((sample,index)=>sample.time-frames[index].time).filter(gap=>gap<=MAX_FRAME_GAP_SAMPLE_MS);
    const cpus=frames.map(sample=>sample.cpu),updates=frames.map(sample=>sample.update),recent=frames.filter(sample=>now-sample.time<=1000);
    const fps=recent.length>1?(recent.length-1)*1000/(recent.at(-1)!.time-recent[0].time):0;
    const latest=frames.at(-1),snapshot=captureRenderer();
    content.textContent=[
      `scene FPS ${fps.toFixed(1)} (draw submissions)   active gap p50/p95/max ${quantile(gaps,.5).toFixed(1)}/${quantile(gaps,.95).toFixed(1)}/${quantile(gaps,1).toFixed(1)} ms`,
      `>50 ms active gaps ${gaps.filter(gap=>gap>50).length} / 5s   CPU update p50/p95 ${quantile(updates,.5).toFixed(1)}/${quantile(updates,.95).toFixed(1)} ms`,
      `CPU renderer p50/p95 ${quantile(cpus,.5).toFixed(1)}/${quantile(cpus,.95).toFixed(1)} ms`,
      `camera request→draw p50/p95 ${quantile(inputLatency,.5).toFixed(1)}/${quantile(inputLatency,.95).toFixed(1)} ms   long tasks ${longTasks.length}`,
      `draw ${latest?.calls??snapshot.calls}   triangles ${((latest?.triangles??snapshot.triangles)/1e6).toFixed(2)} M   programs ${snapshot.programs}`,
      `shadow refreshes ${frames.filter(frame=>frame.shadows).length} / ${frames.length} submitted frames in 5s`,
      `viewport ${snapshot.viewport[0]}×${snapshot.viewport[1]}   buffer ${snapshot.size[0]}×${snapshot.size[1]}   DPR ${snapshot.dpr.toFixed(2)}`,
      `WebGL ${snapshot.webgl2?'2':'1'}   context ${snapshot.contextLost?'lost':'ok'}   max texture ${snapshot.maxTextureSize}`,
      `GPU ${snapshot.renderer}`,
      `platform ${snapshot.platform}   cores ${snapshot.cores}   device memory ${snapshot.memory===undefined?'n/a':`${snapshot.memory} GB`}`,
      `camera z ${snapshot.zoom.toFixed(3)}   yaw ${snapshot.angle.toFixed(3)}   pitch ${snapshot.elevation.toFixed(3)}   pos ${snapshot.camera.map(value=>value.toFixed(1)).join(', ')}`,
      `scene ${snapshot.active?'active':'paused'}   transition ${snapshot.transition?'on':'off'}   journal ${snapshot.journal?'on':'off'}`,
      `ocean ${snapshot.ocean?'on':'off'}   steam ${snapshot.steam?'on':'off'}   lightweight ${snapshot.lightweight?'on':'off'}   reduced motion ${snapshot.reducedMotion?'on':'off'}`,
      `shadows ${snapshot.shadowEnabled?'on':'off'}   ${snapshot.shadowLights.join(', ')||'no shadow lights'}`,
      `leaf LOD ${snapshot.leafLevels.join('/')} / ${snapshot.leafMeshes}   resources ${snapshot.geometries} geometries / ${snapshot.textures} textures`,
      `errors ${snapshot.errors.length?snapshot.errors.slice(-2).join(' | '):'none'}   GPU execution time unavailable (CPU submission only)`,
    ].join('\n');
  }
  function startObservers(){
    if(timer)return;
    if('PerformanceObserver'in window){
      try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.startTime);});observer.observe({type:'longtask',buffered:true});}
      catch{observer?.disconnect();observer=undefined;}
    }
    update();timer=window.setInterval(update,500);
  }
  function stopObservers(){window.clearInterval(timer);timer=0;observer?.disconnect();observer=undefined;frames.length=0;inputLatency.length=0;longTasks.length=0;lastFrameTime=undefined;}
  function show(value:boolean){if(pinned||visible===value)return;visible=value;root.hidden=!visible;if(visible)startObservers();else stopObservers();}
  function modifierChord(event:KeyboardEvent){return event.shiftKey&&(mac?event.metaKey:event.ctrlKey);}
  function trigger(event?:KeyboardEvent){
    if(pinned)return;
    const matches=insideCorner&&Boolean(event?modifierChord(event):chordDown);
    if(!matches){armed=false;return;}
    if(!armed){armed=true;show(!visible);}
  }
  const onPointerMove=(event:PointerEvent)=>{insideCorner=event.clientX<=HOT_CORNER_SIZE&&event.clientY>=innerHeight-HOT_CORNER_SIZE;trigger();};
  const onKeyDown=(event:KeyboardEvent)=>{chordDown=modifierChord(event);trigger(event);};
  const onKeyUp=(event:KeyboardEvent)=>{chordDown=modifierChord(event);trigger(event);};
  const onBlur=()=>{insideCorner=false;chordDown=false;armed=false;if(!pinned)show(false);};
  const onError=(event:ErrorEvent)=>{errors.push((event.message||'JavaScript error').slice(0,120));if(errors.length>8)errors.shift();};
  const onRejection=(event:PromiseRejectionEvent)=>{errors.push(String(event.reason??'Unhandled rejection').slice(0,120));if(errors.length>8)errors.shift();};
  window.addEventListener('pointermove',onPointerMove,{passive:true});
  window.addEventListener('keydown',onKeyDown,{passive:true});window.addEventListener('keyup',onKeyUp,{passive:true});
  window.addEventListener('blur',onBlur);window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  if(pinned){root.hidden=false;startObservers();}
  return {
    record(time:number,cpu:number,update:number,calls:number,triangles:number,shadows:boolean){
      if(!visible)return;
      const sample={time,cpu,update,calls,triangles,shadows};
      if(lastFrameTime!==undefined){const gap=time-lastFrameTime;if(gap<=MAX_FRAME_GAP_SAMPLE_MS)frames.push(sample);else frames.length=0;}
      else frames.push(sample);
      lastFrameTime=time;while(frames.length>1800)frames.shift();
      if(pendingInputTime!==undefined){inputLatency.push(performance.now()-pendingInputTime);pendingInputTime=undefined;}
    },
    recordInput(time:number){if(visible)pendingInputTime=time;},
    dispose(){stopObservers();window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);root.remove();},
  };
}
