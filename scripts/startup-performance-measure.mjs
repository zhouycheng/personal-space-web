import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.PERF_URL??'http://127.0.0.1:4328';
const label=process.env.PERF_LABEL??'B0';
const directory=`.workspace/startup-optimization/${label}`;
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:false});
const report={label,base,browser:browser.version(),viewport:{width:1440,height:900},dpr:1.5,runs:[],
  definitions:{frames:'Render submission intervals, not screen presentation.',memory:'Unique attached geometry attribute/index buffers; not total RAM or VRAM.',startup:'Navigation to prepared entrance, fresh context, browser/driver cache not cleared.'}};
const quantiles=values=>{const s=values.sort((a,b)=>a-b);return {samples:s.length,median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)]};};
try {
  for(let repeat=1;repeat<=3;repeat++) {
    const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:report.dpr});
    await context.addInitScript(()=>{
      const RealDate=Date;
      globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:['2026-10-04T06:00:00.000Z']));}static now(){return new RealDate('2026-10-04T06:00:00.000Z').getTime();}};
      const probe=window.__startupProbe={frames:[],longTasks:[],seen:new WeakSet(),depth:0};
      new PerformanceObserver(list=>probe.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
      window.__THREE_DEVTOOLS__=new EventTarget();
      window.__THREE_DEVTOOLS__.addEventListener('observe',event=>{
        const object=event.detail;
        if(object.isScene)probe.scene=object;
        if(!object.isWebGLRenderer||probe.seen.has(object))return;
        probe.seen.add(object);probe.renderer=object;
        const render=object.render;
        object.render=function(scene,camera){
          if(probe.depth)return render.call(this,scene,camera);
          const start=performance.now();probe.depth++;
          try{return render.call(this,scene,camera);}finally{probe.depth--;probe.frames.push({at:start,cpu:performance.now()-start,calls:object.info.render.calls,triangles:object.info.render.triangles});}
        };
      });
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    await page.goto(`${base}/home`);
    await page.waitForFunction(()=>document.querySelector('[data-cloud-entrance]')?.dataset.state==='ready',null,{timeout:60000});
    const startup=await page.evaluate(()=>{
      const p=window.__startupProbe,r=p.renderer,g=r.getContext(),buffers=new Set();let geometryBytes=0;
      p.scene.traverse(o=>{if(o.geometry)for(const a of [...Object.values(o.geometry.attributes),o.geometry.index].filter(Boolean)){if(!buffers.has(a.array.buffer)){buffers.add(a.array.buffer);geometryBytes+=a.array.byteLength;}}});
      return {navigationToReady:performance.now(),entrance:document.querySelector('[data-cloud-entrance]').dataset.timings,scene:document.querySelector('[data-studio-scene]').dataset.startupTimings,longTasks:p.longTasks,geometryBytes,programs:r.info.programs.length,resources:r.info.memory,renderer:g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL),requests:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),size:e.encodedBodySize,duration:e.duration}))};
    });
    if(/SwiftShader|llvmpipe/i.test(startup.renderer))throw new Error('Hardware renderer required');
    await page.locator('[data-cloud-entrance]').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-cloud-entrance]').hidden,null,{timeout:20000});
    await page.waitForTimeout(1500);
    const scenarios={};
    const sample=async(name,action)=>{
      await page.evaluate(()=>window.__startupProbe.frames=[]);await action();
      const raw=await page.evaluate(()=>window.__startupProbe.frames);
      scenarios[name]={frameGap:quantiles(raw.slice(1).map((f,i)=>f.at-raw[i].at)),cpu:quantiles(raw.map(f=>f.cpu)),calls:quantiles(raw.map(f=>f.calls)),triangles:quantiles(raw.map(f=>f.triangles)),raw};
    };
    await sample('idle',()=>page.waitForTimeout(2200));
    await sample('orbit',async()=>{await page.mouse.move(680,450);await page.mouse.down();for(let i=0;i<=60;i++){const t=i/60*Math.PI*2;await page.mouse.move(680+Math.sin(t)*180,450+Math.sin(t)*55);await page.waitForTimeout(16);}await page.mouse.up();await page.waitForTimeout(500);});
    await sample('zoom',async()=>{for(let i=0;i<30;i++){await page.mouse.move(660+i*6,590+i%4*4);await page.mouse.wheel(0,i<15?-14:14);}await page.waitForTimeout(500);});
    await sample('entryReturn',async()=>{await page.locator('.studio-direct-links [data-studio-action="computer"]').click();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='desktop');await page.locator('[data-studio-return]').click();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');});
    if(repeat===1){
      await page.emulateMedia({reducedMotion:'reduce'});
      // Freeze at a deterministic zero-wind frame in a fresh page for pixel comparison.
      const visual=await context.newPage();await visual.emulateMedia({reducedMotion:'reduce'});await visual.goto(`${base}/home`);
      await visual.waitForFunction(()=>document.querySelector('[data-cloud-entrance]')?.dataset.state==='ready',null,{timeout:60000});await visual.keyboard.press('Enter');await visual.waitForFunction(()=>document.querySelector('[data-cloud-entrance]').hidden);
      for(const [name,viewport] of [['desktop',report.viewport],['narrow',{width:390,height:844}]]){await visual.setViewportSize(viewport);await visual.waitForTimeout(400);await visual.screenshot({path:`${directory}/${name}.png`});}
      await visual.close();
    }
    const heap=await cdp.send('Performance.getMetrics');
    report.runs.push({repeat,startup,scenarios,metrics:heap.metrics,errors});
    await writeFile(`${directory}/results.json`,JSON.stringify(report,null,2));
    console.log(JSON.stringify({repeat,startupMs:startup.navigationToReady,geometryBytes:startup.geometryBytes,scenarios:Object.fromEntries(Object.entries(scenarios).map(([k,v])=>[k,{...v,raw:undefined}]))}));
    await context.close();
  }
}finally{await browser.close();}
