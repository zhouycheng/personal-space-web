import { expect, test, type Page, type APIRequestContext } from 'playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';
import { phase } from './helpers/journal';

const overlay=(page:Page)=>page.locator('[data-cloud-entrance]');
async function ready(page:Page) { await expect(overlay(page)).toHaveAttribute('data-state','ready',{timeout:35000}); }
async function enter(page:Page) { await ready(page); await overlay(page).focus();await page.keyboard.press('Enter');await expect(overlay(page)).toBeHidden({timeout:15000}); }

test('loading reports real progress and a completed refresh auto-fades the cloud cover',async({page},info)=>{
  test.setTimeout(120_000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Fix the cloud palette without mocking PerformanceNavigationTiming on reload.
  await page.addInitScript(()=>{Date.prototype.getHours=()=>14;Date.prototype.getMinutes=()=>0;});
  await page.addInitScript(()=>{
    Reflect.set(window,'cloudTextFrames',[]);
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,_x,y){
      if(this.canvas.matches('[data-cloud-canvas]'))Reflect.get(window,'cloudTextFrames').push({
        state:(this.canvas.closest('[data-cloud-entrance]') as HTMLElement).dataset.state,
        text,y:y*this.canvas.clientHeight/this.canvas.height,
      });
      return Reflect.apply(original,this,arguments);
    };
  });
  let gate:Promise<void>|undefined;
  let releaseInitial!:()=>void;
  gate=new Promise<void>(resolve=>{releaseInitial=resolve;});
  await page.route('**/*waternormals*',async route=>{if(gate)await gate;await route.continue();});
  await page.goto('/home?source=entrance&entrance=skip#start',{waitUntil:'domcontentloaded'});
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(page.locator('[data-cloud-status]')).toHaveText('正在准备海面与材质');
  const progressBar=overlay(page).locator('[data-cloud-progress]');
  await expect(progressBar).toHaveAttribute('role','progressbar');
  await expect(progressBar).toHaveAttribute('aria-valuenow','40');
  await expect(progressBar).toHaveAttribute('aria-valuetext','正在准备海面与材质，40%');
  await expect(progressBar).toBeVisible();
  await expect(progressBar.locator('.cloud-entrance__progress-fill')).toHaveCSS('transition-property','transform');
  await expect.poll(()=>progressBar.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('cloud-progress-stream');
  const streamTransform=await progressBar.evaluate(el=>getComputedStyle(el,'::after').transform);
  await expect.poll(()=>progressBar.evaluate(el=>getComputedStyle(el,'::after').transform)).not.toBe(streamTransform);
  await expect(overlay(page).locator('.cloud-entrance__fallback')).toHaveCount(0);
  await expect(page.locator('[data-cloud-status]')).toHaveAttribute('aria-live','polite');
  await expect(page.locator('[data-cloud-status]')).toHaveCSS('color','rgba(0, 0, 0, 0)');
  const initialPalette=await overlay(page).evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim());
  expect(initialPalette).toMatch(/^#[\da-f]{6}$/i);
  await overlay(page).click({position:{x:100,y:100}});
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
  await page.screenshot({path:info.outputPath('loading.png')});
  const loadingY=await page.locator('[data-cloud-status]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;});
  // Start sampling before releasing the gate; ready may arrive within 200ms.
  await overlay(page).evaluate(root=>{Reflect.set(window,'cloudCompletion',(async()=>{
    const bar=root.querySelector<HTMLElement>('[data-cloud-progress]')!;
    const status=root.querySelector<HTMLElement>('[data-cloud-status]')!;
    const samples:{opacity:number;y:number}[]=[];
    while(true){
      if((root as HTMLElement).dataset.state==='ready'){
        const style=getComputedStyle(bar),r=status.getBoundingClientRect();
        samples.push({opacity:Number(style.opacity),y:r.top+r.height/2});
        if(style.visibility==='hidden')return samples;
      }
      await new Promise(requestAnimationFrame);
    }
  })());});
  releaseInitial();gate=undefined;
  const completedFrames=await page.evaluate(()=>Reflect.get(window,'cloudCompletion') as Promise<{opacity:number;y:number}[]>);await ready(page);
  await info.attach('ready-frames.json',{contentType:'application/json',body:JSON.stringify(completedFrames)});
  expect(completedFrames.filter(frame=>frame.opacity>0&&frame.opacity<1).length).toBeGreaterThan(2);
  expect(completedFrames.every(frame=>Math.abs(frame.y-loadingY)<1)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudTextFrames').some((frame:{state:string})=>frame.state==='ready'))).toBe(true);
  const initialTextFrames=await page.evaluate(()=>Reflect.get(window,'cloudTextFrames') as {state:string;y:number}[]);
  expect(initialTextFrames.filter(frame=>['loading','ready'].includes(frame.state)).every(frame=>Math.abs(frame.y-loadingY)<1)).toBe(true);
  await expect(page.locator('[data-cloud-status]')).toHaveCount(1);
  await expect(page.locator('[data-cloud-status]')).toHaveText('点击拨开云雾');
  await expect(progressBar).toBeHidden();
  await expect(progressBar).toHaveAttribute('aria-valuenow','100');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active','false');
  await page.locator('[data-cloud-entrance]').dispatchEvent('pointerleave');await page.waitForTimeout(1000);
  const before=await page.screenshot();
  const bounds=(await overlay(page).boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width*.42,bounds.y+bounds.height*.5);await page.waitForTimeout(500);
  expect(before.equals(await page.screenshot({path:info.outputPath('hover.png')}))).toBe(false);
  await enter(page);await expect(page).toHaveURL(/\/home\?source=entrance#start$/);
  // An old bookmarked skip URL must also use the automatic cover on refresh.
  await page.evaluate(()=>history.replaceState(history.state,'','/home?source=entrance&entrance=skip#start'));
  let releaseRefresh!:()=>void;
  gate=new Promise<void>(resolve=>{releaseRefresh=resolve;});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(page.locator('[data-cloud-status]')).toHaveText('正在准备海面与材质');
  const refreshPalette=await overlay(page).evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim());
  expect(refreshPalette).toMatch(/^#[\da-f]{6}$/i);
  await expect.poll(()=>overlay(page).evaluate(el=>Number.parseFloat(getComputedStyle(el).getPropertyValue('--cloud-progress')))).toBeGreaterThan(0);
  const refreshY=await page.locator('[data-cloud-status]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;});
  // Sample actual frames: a delayed protocol read can land after dispose resets opacity.
  await overlay(page).evaluate(root=>{Reflect.set(window,'cloudFade',(async()=>{
    const status=root.querySelector<HTMLElement>('[data-cloud-status]')!;
    const bar=root.querySelector<HTMLElement>('[data-cloud-progress]')!;
    const samples:{opacity:number;y:number;barVisible:boolean}[]=[];
    while (!(root as HTMLElement).hidden) {
      if ((root as HTMLElement).dataset.state === 'dismissing') {
        const r=status.getBoundingClientRect(),bounds=root.getBoundingClientRect(),style=getComputedStyle(bar);
        samples.push({opacity:Number(getComputedStyle(root).opacity),y:(r.top-bounds.top+r.height/2)*root.clientHeight/bounds.height,barVisible:style.visibility==='visible'&&Number(style.opacity)===1});
      }
      await new Promise(requestAnimationFrame);
    }
    return samples;
  })());});
  releaseRefresh();gate=undefined;
  const fadeFrames=await page.evaluate(()=>Reflect.get(window,'cloudFade') as Promise<{opacity:number;y:number;barVisible:boolean}[]>);
  await info.attach('refresh-frames.json',{contentType:'application/json',body:JSON.stringify(fadeFrames)});
  expect(fadeFrames.filter(frame=>frame.opacity>0&&frame.opacity<1).length).toBeGreaterThan(2);
  expect(fadeFrames.every(frame=>Math.abs(frame.y-refreshY)<1&&frame.barVisible)).toBe(true);
  const refreshTextFrames=await page.evaluate(()=>Reflect.get(window,'cloudTextFrames') as {state:string;y:number}[]);
  expect(refreshTextFrames.some(frame=>frame.state==='dismissing')).toBe(true);
  expect(refreshTextFrames.filter(frame=>['loading','dismissing'].includes(frame.state)).every(frame=>Math.abs(frame.y-refreshY)<1)).toBe(true);
  await expect(overlay(page)).toBeHidden({timeout:15000});
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-ocean-active','true');
  await expect(page).toHaveURL(/\/home\?source=entrance#start$/);
});

for(const path of ['/','/home','/works','/canvas','/os','/journal']) {
  test(`fresh ${path} preserves the requested route and refresh auto-fades`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`${path}?source=test#entry`);await ready(page);
    await expect(page.locator('[data-studio]')).toHaveAttribute('inert','');
    await enter(page);
    const expected=path==='/'?'/home':path;
    // /journal may select the default article; published slug links are tested below.
    if(path!=='/journal')await expect(page).toHaveURL(new RegExp(`${expected.replace('/','\\/')}\\?source=test#entry$`));
    const returnFocus=page.locator('[data-studio-return]:focus,[data-canvas-return]:focus,[data-gallery-return]:focus,[data-journal-close]:focus');
    await expect(returnFocus).toHaveCount(0);
    if(path==='/journal')await phase(page,'reading');
    await page.reload();await expect(overlay(page)).toBeHidden({timeout:35000});
    const state=path==='/os'?'desktop':path==='/canvas'?'canvas':path==='/journal'?'journal':'room';
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state',state);
    await expect(returnFocus).toHaveCount(0);
    if(path==='/journal')await phase(page,'reading');
    await page.screenshot({path:info.outputPath('refreshed.png')});
    if(['/works','/canvas','/os'].includes(path)) {
      await page.keyboard.press('Tab');
      await expect(page.locator('.alpha-shell :focus-visible')).toHaveCount(1);
    }
  });
}

test('camera and clouds share progress, survive resize, land without bounce and allow ordinary controls',async({page},info)=>{
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date(2026,9,4,14));await page.goto('/home');await ready(page);
  await page.clock.install({time:new Date(2026,9,4,14)});await page.clock.pauseAt(new Date(2026,9,4,14,0,1));
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await expect(overlay(page).locator('[data-cloud-progress]')).toBeHidden();
  // Establish the active clock, then sample its elapsed-time poses without rendering every skipped frame.
  await page.clock.runFor(16);await page.clock.fastForward(134);
  await expect(overlay(page).locator('[data-cloud-progress]')).toBeHidden();
  await page.screenshot({path:info.outputPath('prompt-dissolving.png')});
  await page.clock.fastForward(200);
  await expect(overlay(page).locator('[data-cloud-progress]')).toBeHidden();
  await page.screenshot({path:info.outputPath('far-B.png')});
  await page.clock.fastForward(700);
  await page.screenshot({path:info.outputPath('mid-reveal.png')});
  const progress=Number(await page.locator('[data-studio-scene]').getAttribute('data-entrance-progress'));
  expect(progress).toBeGreaterThan(.25);expect(progress).toBeLessThan(.5);
  await page.setViewportSize({width:390,height:844});
  await page.clock.fastForward(600);await page.screenshot({path:info.outputPath('narrow-reveal.png')});
  await page.clock.fastForward(1600);await expect(overlay(page)).toBeHidden();
  await page.screenshot({path:info.outputPath('narrow-settled.png')});
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-camera-angle','-0.4800');await expect(mount).toHaveAttribute('data-camera-zoom','1.0000');
  await page.clock.fastForward(500);await expect(mount).toHaveAttribute('data-camera-angle','-0.4800');
  await page.clock.resume();
  await page.mouse.move(55,210);await page.mouse.down();await page.mouse.move(125,230,{steps:8});await page.mouse.up();
  await expect(mount).not.toHaveAttribute('data-camera-angle','-0.4800');
  await page.mouse.wheel(0,-350);await expect.poll(async()=>Number(await mount.getAttribute('data-camera-zoom'))).toBeGreaterThan(1.05);
});

test('a published journal slug and anchor survive entrance; history does not acquire a synthetic home entry',async({page})=>{
  const book=await (await page.request.get('/journal/generated/manifest.json')).json();
  const article=book.articles[0];const anchor=book.pages[article.start].anchors[0]??'missing-anchor';
  const path=`/journal/${encodeURIComponent(article.slug)}?source=deep#${encodeURIComponent(anchor)}`;
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(path);
  const length=await page.evaluate(()=>history.length);await enter(page);
  await expect(page.locator('[data-journal-root]')).toHaveAttribute('data-phase','reading',{timeout:35000});
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(article.slug)));
  expect(await page.evaluate(()=>location.search+location.hash)).toBe(`?source=deep#${encodeURIComponent(anchor)}`);
  expect(await page.evaluate(()=>history.length)).toBe(length);
  const readingPage=await page.locator('canvas[data-journal-phase]').getAttribute('data-journal-page');
  await page.reload();await expect(overlay(page)).toBeHidden({timeout:35000});await phase(page,'reading');
  await expect(page.locator('canvas[data-journal-phase]')).toHaveAttribute('data-journal-page',readingPage!);
  expect(await page.evaluate(()=>location.search+location.hash)).toBe(`?source=deep#${encodeURIComponent(anchor)}`);
  expect(await page.evaluate(()=>history.length)).toBe(length);
});

test('WebGL denial exposes independent retry and usable content exits',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return /webgl/.test(type)?null:Reflect.apply(original,this,[type,...args]);} as typeof original;
  });
  await page.goto('/home');await expect(overlay(page)).toHaveAttribute('data-state','error');
  await expect(overlay(page).locator('[data-cloud-progress]')).toBeHidden();
  await expect(page.locator('[data-cloud-retry]')).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
  await page.locator('[data-cloud-error] a[href*="/os"]').click();
  await expect(overlay(page)).toBeHidden();await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','desktop');
  await expect(page).toHaveURL(/\/os$/);
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
});

async function mountStandaloneCloud(page: Page, request: APIRequestContext) {
  const body=await (await request.get('/home')).text();
  const html=await page.evaluate(body=>new DOMParser().parseFromString(body,'text/html').querySelector('[data-cloud-entrance]')!.outerHTML,body);
  const css=await readFile('src/justin-kit/components/cloud-entrance/cloud-entrance.css','utf8');
  const timePalette=await readFile('src/justin-kit/components/cloud-entrance/timePalette.ts','utf8');
  const field=await readFile('src/justin-kit/components/cloud-entrance/fogField.ts','utf8');
  const shortcuts=await readFile('src/justin-kit/runtime/shortcuts.ts','utf8');
  const runtime=(await readFile('src/justin-kit/components/cloud-entrance/runtime.ts','utf8'))
    .replace("import { createFogField, createFogTrail } from './fogField';",'')
    .replace("import { entranceTimePalette, paletteHex } from './timePalette';",'')
    .replace("import { getShortcutSystem } from '../../runtime/shortcuts';",'');
  const paletteSource=ts.transpileModule(timePalette,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const fieldSource=ts.transpileModule(field,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace('const smooth =','const fieldSmooth =').replaceAll('smooth(', 'fieldSmooth(');
  const shortcutsSource=ts.transpileModule(shortcuts,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const source=ts.transpileModule(runtime,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const demo=`${paletteSource}\n${fieldSource}\n${shortcutsSource}\n${source}\nconst root=document.querySelector('[data-cloud-entrance]');
    // Exercise the same renderer even when Canvas filters are unavailable.
    Object.defineProperty(CanvasRenderingContext2D.prototype,'filter',{configurable:true,get(){return undefined;},set(){throw new Error('Canvas filter is unavailable');}});
    const NativeResizeObserver=window.ResizeObserver;
    window.ResizeObserver=class extends NativeResizeObserver {constructor(callback){super(callback);window.cloudResize=()=>callback([],this);}};
    window.cloudCanvasText=[];window.cloudCanvasStatus=[];const originalFillText=CanvasRenderingContext2D.prototype.fillText;
    window.cloudFrames=0;const originalClearRect=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){
      if(this.canvas.matches('[data-cloud-canvas]'))window.cloudFrames++;
      return Reflect.apply(originalClearRect,this,args);
    };
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      window.cloudCanvasText.push(String(text));
      if(this.canvas.matches('[data-cloud-canvas]'))window.cloudCanvasStatus.push({state:this.canvas.closest('[data-cloud-entrance]').dataset.state,y:args[1]*this.canvas.clientHeight/this.canvas.height});
      return Reflect.apply(originalFillText,this,[text,...args]);
    };
    root.querySelector('.cloud-entrance__information').innerHTML='<button data-cloud-no-enter>个人信息</button>';
    window.enterCount=0;window.cloud=createCloudEntrance(root,()=>{window.enterCount++;},()=>{});
    window.cloud.setProgress(.4);window.cloud.setState('loading');`;
  const htmlDocument=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${html}<script type="module">${demo}</script>`;
  await page.clock.setFixedTime(new Date(2026,9,5,1));
  await mkdir('.workspace/entrance-validation',{recursive:true});await writeFile('.workspace/entrance-validation/standalone.html',htmlDocument);
  await page.setContent(htmlDocument);
}

test('standalone hover trail reveals soft local lettering and recovers through entrance lifecycle', async ({ page, request }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date(2026, 9, 5, 1) });
  await page.clock.pauseAt(new Date(2026, 9, 5, 1, 0, 1));
  await mountStandaloneCloud(page, request);
  const entrance = overlay(page);
  const frames = () => page.evaluate(() => Reflect.get(window, 'cloudFrames') as number);
  const captureBaseline = () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-cloud-canvas]')!;
    Reflect.set(window, 'cloudBaseline', canvas.getContext('2d')!.getImageData(0, 0, canvas.width, Math.floor(canvas.height * .75)));
  });
  const difference = () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-cloud-canvas]')!;
    const baseline = Reflect.get(window, 'cloudBaseline') as ImageData;
    const current = canvas.getContext('2d')!.getImageData(0, 0, baseline.width, baseline.height).data;
    let changed = 0, distant = 0, opaque = true;
    for (let i = 0; i < current.length; i += 4) {
      opaque &&= current[i + 3] === 255;
      if (current[i] !== baseline.data[i] || current[i + 1] !== baseline.data[i + 1] || current[i + 2] !== baseline.data[i + 2]) {
        changed++;
        if (i / 4 % baseline.width > baseline.width * .8) distant++;
      }
    }
    return { changed, distant, opaque };
  });
  const sweep = async (y = .5) => {
    const { width, height } = page.viewportSize()!;
    await entrance.dispatchEvent('pointerleave');
    await page.mouse.move(width * .32, height * y);
    await page.clock.runFor(48);
    await page.mouse.move(width * .45, height * y, { steps: 6 });
    await page.clock.runFor(120);
  };
  for (const [label, hour] of [['night', 1], ['day', 12]] as const) {
    await page.clock.setFixedTime(new Date(2026, 9, 5, hour));
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); Reflect.get(window, 'cloud').setState('loading'); });
    await page.clock.runFor(32);
    await captureBaseline();
    await page.screenshot({ path: info.outputPath(`trail-${label}-before.png`) });
    await sweep(.25);
    const empty = await difference();
    expect(empty.changed).toBeGreaterThan(20); expect(empty.distant).toBe(0); expect(empty.opaque).toBe(true);
    await page.screenshot({ path: info.outputPath(`trail-${label}-mist.png`) });
    await page.evaluate(() => Reflect.get(window, 'cloud').setState('ready'));
    await page.clock.runFor(32);
    expect((await difference()).changed).toBeGreaterThan(0);
    await page.clock.runFor(1700);
    expect((await difference()).changed).toBe(0);
    await sweep();
    const lettering = await difference();
    expect(lettering.changed).toBeGreaterThan(20); expect(lettering.distant).toBe(0); expect(lettering.opaque).toBe(true);
    await page.screenshot({ path: info.outputPath(`trail-${label}-lettering.png`) });
    await page.clock.runFor(800);
    expect((await difference()).changed).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(`trail-${label}-tail.png`) });
    await page.clock.runFor(900);
    expect((await difference()).changed).toBe(0);
    const idleFrames = await frames();
    await page.clock.runFor(200);
    expect(await frames()).toBe(idleFrames);
    await page.screenshot({ path: info.outputPath(`trail-${label}-recovered.png`) });
  }
  await sweep();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await frames(), pausedDifference = await difference();
  await page.clock.runFor(2500);
  expect(await frames()).toBe(paused); expect(await difference()).toEqual(pausedDifference);
  await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(32);
  expect((await difference()).changed).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const cachedFrames = await frames();
  await page.clock.runFor(2500); expect(await frames()).toBe(cachedFrames);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.clock.runFor(1700); expect((await difference()).changed).toBe(0);

  await sweep();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // WebKit delivers the media change on its native rendering cycle, outside the paused clock.
  await expect.poll(async () => { await page.clock.runFor(32); return (await difference()).changed; }, { timeout: 1000, intervals: [50, 100, 250] }).toBe(0);
  await sweep(); expect((await difference()).changed).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.clock.runFor(32);
  await entrance.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 100 });
  await page.clock.runFor(120); expect((await difference()).changed).toBe(0);
  for (const state of ['error', 'revealing', 'dismissing']) {
    await page.evaluate(() => Reflect.get(window, 'cloud').setState('ready')); await page.clock.runFor(32);
    await sweep(); expect((await difference()).changed).toBeGreaterThan(0);
    await page.evaluate(state => Reflect.get(window, 'cloud').setState(state), state);
    await page.clock.runFor(32); expect((await difference()).changed).toBe(0);
    await sweep(); expect((await difference()).changed).toBe(0);
  }
  await page.evaluate(() => Reflect.get(window, 'cloud').setState('ready')); await page.clock.runFor(32);
  await sweep();
  const originalSize = page.viewportSize()!;
  await page.setViewportSize({ width: Math.max(320, originalSize.width - 80), height: originalSize.height - 40 });
  await page.clock.runFor(32); await captureBaseline();
  await sweep(); expect((await difference()).changed).toBeGreaterThan(0); expect((await difference()).opaque).toBe(true);
  await page.clock.runFor(1700); expect((await difference()).changed).toBe(0);
  await entrance.focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => Reflect.get(window, 'enterCount'))).toBe(1);
  await sweep();
  await page.evaluate(() => Reflect.get(window, 'cloud').dispose());
  const disposedFrames = await frames();
  await page.clock.runFor(2000); expect(await frames()).toBe(disposedFrames);
  expect(await entrance.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(0);
});

test('standalone component needs no scene, slots are safe and disposed canvas releases its buffers',async({page,request},info)=>{
  test.setTimeout(90_000);
  await mountStandaloneCloud(page, request);
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(overlay(page)).toHaveAttribute('data-painted','true');
  await expect(overlay(page).locator('.cloud-entrance__fallback')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasText').includes('Justin'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasText').includes('正在加载场景'))).toBe(true);
  const entrance=overlay(page);
  const progressBar=entrance.locator('[data-cloud-progress]');
  await expect(progressBar).toHaveAttribute('aria-valuenow','40');
  await expect(progressBar).toHaveAttribute('aria-valuetext','正在加载场景，40%');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(progressBar.locator('.cloud-entrance__progress-fill')).toHaveCSS('transition-property','transform');
  await expect.poll(()=>progressBar.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('cloud-progress-stream');
  expect(await entrance.evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim())).toBe('#161e2e');
  await page.screenshot({path:info.outputPath('standalone-night.png')});
  await page.evaluate(()=>Reflect.get(window,'cloud').setProgress(0));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(undefined))));
  await page.evaluate(()=>Reflect.get(window,'cloud').setProgress(.8));
  await expect(progressBar).toHaveAttribute('aria-valuenow','80');
  const widths=await progressBar.evaluate(async bar=>{const fill=bar.querySelector('.cloud-entrance__progress-fill')!;const samples:number[]=[];for(let i=0;i<10;i++){samples.push(fill.getBoundingClientRect().width);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}return samples;});
  expect(widths.at(-1)).toBeGreaterThan(widths[0]);
  expect(new Set(widths).size).toBeGreaterThan(6);
  // Target changes must preserve the water animation objects and their phase.
  await page.evaluate(()=>Reflect.set(window,'waterAnimations',document.querySelector('[data-cloud-progress]')!.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation)));
  expect(await page.evaluate(()=>Reflect.get(window,'waterAnimations').length)).toBe(2);
  for (const value of [0,.2,.8]) {
    await page.evaluate(value=>Reflect.get(window,'cloud').setProgress(value),value);
    await expect(progressBar).toHaveAttribute('aria-valuenow',String(value*100));
    expect(await progressBar.evaluate(bar=>bar.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation).every((a,i)=>a===Reflect.get(window,'waterAnimations')[i]))).toBe(true);
    const frames=await progressBar.evaluate(async bar=>{const before=getComputedStyle(bar,'::after').transform;await new Promise(resolve=>setTimeout(resolve,100));return [before,getComputedStyle(bar,'::after').transform];});
    expect(frames[0]).not.toBe(frames[1]);
  }
  await page.waitForTimeout(850);
  expect(await progressBar.evaluate(bar=>bar.querySelector('.cloud-entrance__progress-fill')!.getBoundingClientRect().width/bar.getBoundingClientRect().width)).toBeCloseTo(.8,2);
  for (const event of ['pagehide','pageshow']) {
    await page.evaluate(event=>window.dispatchEvent(new Event(event)),event);
    await expect.poll(()=>progressBar.evaluate(bar=>getComputedStyle(bar,'::after').animationName)).toBe(event==='pagehide'?'none':'cloud-progress-stream');
    await expect(progressBar.locator('.cloud-entrance__progress-fill')).toHaveCSS('will-change',event==='pagehide'?'auto':'transform');
  }
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('error','准备中断'));
  await expect(progressBar).toBeHidden();
  await expect.poll(()=>progressBar.evaluate(bar=>getComputedStyle(bar,'::after').animationName)).toBe('none');
  await page.evaluate(()=>{Reflect.get(window,'cloud').setProgress(0);Reflect.get(window,'cloud').setState('loading');});
  await expect(progressBar).toHaveAttribute('aria-valuenow','0');
  await expect.poll(()=>progressBar.evaluate(bar=>getComputedStyle(bar,'::after').animationName)).toBe('cloud-progress-stream');
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('loading','正在准备首帧'));
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasText').includes('正在准备首帧'))).toBe(true);
  await page.clock.setFixedTime(new Date(2026,9,5,12));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  expect(await entrance.evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim())).toBe('#c6d0d2');
  await page.screenshot({path:info.outputPath('standalone-day.png')});
  const pausedReadyTime=await page.evaluate(async()=>{
    Reflect.get(window,'cloud').setState('ready');
    await new Promise(requestAnimationFrame);
    const animation=document.querySelector('[data-cloud-progress]')!.getAnimations()[0];
    animation.currentTime=80;Reflect.set(window,'readyAnimation',animation);
    window.dispatchEvent(new Event('pagehide'));
    await animation.ready;
    return animation.currentTime as number;
  });
  await expect(progressBar).toBeVisible();
  const pausedOpacity=Number(await progressBar.evaluate(bar=>getComputedStyle(bar).opacity));
  expect(pausedOpacity).toBeGreaterThan(0);expect(pausedOpacity).toBeLessThan(1);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>Reflect.get(window,'readyAnimation').currentTime as number)).toBeCloseTo(pausedReadyTime,2);
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await expect(progressBar).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(()=>Reflect.get(window,'readyAnimation').playState)).toBe('finished');
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  expect(await page.evaluate(()=>Reflect.get(window,'readyAnimation').playState)).toBe('finished');
  await expect(progressBar).toBeHidden();
  expect(await page.evaluate(async()=>{
    Reflect.get(window,'cloud').setState('loading');Reflect.get(window,'cloud').setState('ready');
    await new Promise(requestAnimationFrame);
    Reflect.get(window,'cloud').setState('error','准备中断');
    return document.querySelector('[data-cloud-progress]')!.getAnimations().length;
  })).toBe(0);
  await expect(progressBar).toBeHidden();
  await page.evaluate(()=>{Reflect.get(window,'cloud').setProgress(.8);Reflect.get(window,'cloud').setState('loading','正在准备首帧');});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(progressBar.locator('.cloud-entrance__progress-fill')).toHaveCSS('animation-name','none');
  await expect(progressBar.locator('.cloud-entrance__progress-fill')).toHaveCSS('transition-duration','0s');
  for (const pseudo of ['::before','::after']) {
    await expect.poll(()=>progressBar.evaluate((bar,pseudo)=>getComputedStyle(bar,pseudo).animationName,pseudo)).toBe('none');
    await expect.poll(()=>progressBar.evaluate((bar,pseudo)=>getComputedStyle(bar,pseudo).willChange,pseudo)).toBe('auto');
  }
  const loadingStatusY=await page.locator('[data-cloud-status]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;});
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('ready'));
  await ready(page);
  await expect(progressBar).toBeHidden();
  await expect(progressBar).toHaveAttribute('aria-valuenow','100');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasText').includes('点击拨开云雾'))).toBe(true);
  expect(await page.locator('[data-cloud-status]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;})).toBeCloseTo(loadingStatusY,1);
  await page.getByRole('button',{name:'个人信息'}).click();
  expect(await page.evaluate(()=>Reflect.get(window,'enterCount'))).toBe(0);
  await overlay(page).focus();await page.keyboard.press('Space');
  expect(await page.evaluate(()=>Reflect.get(window,'enterCount'))).toBe(1);
  await page.screenshot({path:info.outputPath('standalone.png')});
  await overlay(page).dispatchEvent('pointerleave');
  await page.waitForTimeout(1200);
  const initial = await page.locator('[data-cloud-canvas]').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  // Observer notifications with unchanged dimensions must not clear the cover.
  expect(await page.evaluate(()=>{
    Reflect.get(window,'cloudResize')();
    return document.querySelector<HTMLCanvasElement>('[data-cloud-canvas]')!.toDataURL();
  })).toBe(initial);
  // A real resize must also finish painting before returning from the observer.
  expect(await page.evaluate(()=>{
    const root=document.querySelector<HTMLElement>('[data-cloud-entrance]')!;
    root.style.width='80%';Reflect.get(window,'cloudResize')();
    const canvas=root.querySelector<HTMLCanvasElement>('canvas')!;
    return canvas.getContext('2d')!.getImageData(0,0,1,1).data[3];
  })).toBe(255);
  await page.evaluate(()=>{document.querySelector<HTMLElement>('[data-cloud-entrance]')!.style.width='';Reflect.get(window,'cloudResize')();});
  await page.evaluate(() => {
    Reflect.get(window, 'cloud').setState('revealing');
    Reflect.get(window, 'cloud').setRevealProgress(0);
  });
  await expect(progressBar).toBeHidden();
  expect(await page.locator('[data-cloud-canvas]').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).not.toBe(initial);
  for (const [label, hour] of [['day', 12], ['night', 1], ['dawn', 6], ['dusk', 18]] as const) {
    await page.clock.setFixedTime(new Date(2026, 9, 5, hour));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    for (const progress of [0, .15, .35, .6, .85]) {
      await page.evaluate(progress => Reflect.get(window, 'cloud').setRevealProgress(progress), progress);
      await page.screenshot({path:info.outputPath(`cloud-${label}-${progress}.png`)});
    }
  }
  // A route change or failure during automatic dismissal must restore its cover.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{
    void Reflect.get(window,'cloud').dismiss(1000);
    const animation=document.querySelector('[data-cloud-entrance]')!.getAnimations()[0];
    animation.pause();animation.currentTime=500;
  });
  expect(Number(await entrance.evaluate(el=>getComputedStyle(el).opacity))).toBeLessThan(1);
  await expect(progressBar).toBeHidden();
  await expect(entrance).not.toHaveAttribute('data-dismiss-progress','');
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('loading'));
  await expect(entrance).toHaveCSS('opacity','1');
  await expect(progressBar).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasStatus').at(-1).state)).toBe('loading');
  const beforeDismissY=await page.evaluate(()=>Reflect.get(window,'cloudCanvasStatus').at(-1).y as number);
  await page.evaluate(()=>{
    Reflect.get(window,'cloud').setProgress(1);
    void Reflect.get(window,'cloud').dismiss(1000);
    const animation=document.querySelector('[data-cloud-entrance]')!.getAnimations()[0];
    animation.pause();animation.currentTime=500;
  });
  await expect(progressBar).toBeVisible();
  await expect(progressBar).toHaveAttribute('aria-valuenow','100');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'cloudCanvasStatus').at(-1).state)).toBe('dismissing');
  expect(await page.evaluate(()=>Reflect.get(window,'cloudCanvasStatus').at(-1).y as number)).toBeCloseTo(beforeDismissY,1);
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('error','准备中断'));
  await expect(entrance).toHaveCSS('opacity','1');
  await expect(progressBar).toBeHidden();
  await expect(entrance).not.toHaveAttribute('data-dismiss-progress','');
  await page.evaluate(()=>{Reflect.get(window,'cloud').setState('loading');Reflect.get(window,'cloud').setProgress(0);});
  await expect(progressBar).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>Reflect.get(window,'cloud').dismiss(1000));
  await expect(entrance).toHaveCSS('opacity','0');
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('loading'));
  await expect(entrance).toHaveCSS('opacity','1');
  await page.evaluate(()=>Reflect.get(window,'cloud').dismiss(0));
  await expect(entrance).toHaveCSS('opacity','0');
  await page.evaluate(()=>Reflect.get(window,'cloud').dispose());
  expect(await page.locator('[data-cloud-canvas]').evaluate(canvas=>(canvas as HTMLCanvasElement).width)).toBe(0);
});
