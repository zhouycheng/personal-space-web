import { expect, test, type Page } from 'playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';

const overlay=(page:Page)=>page.locator('[data-cloud-entrance]');
async function ready(page:Page) { await expect(overlay(page)).toHaveAttribute('data-state','ready',{timeout:35000}); }
async function enter(page:Page) { await ready(page); await overlay(page).focus();await page.keyboard.press('Enter');await expect(overlay(page)).toBeHidden({timeout:15000}); }

test('loading reports real progress and a completed refresh auto-fades the cloud cover',async({page},info)=>{
  test.setTimeout(90_000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Fix the cloud palette without mocking PerformanceNavigationTiming on reload.
  await page.addInitScript(()=>{Date.prototype.getHours=()=>14;Date.prototype.getMinutes=()=>0;});
  let gate:Promise<void>|undefined;
  let releaseInitial!:()=>void;
  gate=new Promise<void>(resolve=>{releaseInitial=resolve;});
  await page.route('**/*waternormals*',async route=>{if(gate)await gate;await route.continue();});
  await page.goto('/home?source=entrance#start',{waitUntil:'domcontentloaded'});
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(page.locator('[data-cloud-status]')).toHaveText('正在准备海面与材质');
  const initialPalette=await overlay(page).evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim());
  expect(initialPalette).toMatch(/^#[\da-f]{6}$/i);
  await overlay(page).click({position:{x:100,y:100}});
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
  await page.screenshot({path:info.outputPath('loading.png')});
  releaseInitial();gate=undefined;await ready(page);
  await expect(page.locator('[data-cloud-status]')).toHaveCount(1);
  await expect(page.locator('[data-cloud-status]')).toHaveText('点击拨开云雾');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active','false');
  await page.locator('[data-cloud-entrance]').dispatchEvent('pointerleave');await page.waitForTimeout(1000);
  const before=await page.screenshot();
  const bounds=(await overlay(page).boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width*.42,bounds.y+bounds.height*.5);await page.waitForTimeout(500);
  expect(before.equals(await page.screenshot({path:info.outputPath('hover.png')}))).toBe(false);
  await enter(page);await expect(page).toHaveURL(/\/home\?source=entrance#start$/);
  let releaseRefresh!:()=>void;
  gate=new Promise<void>(resolve=>{releaseRefresh=resolve;});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(page.locator('[data-cloud-status]')).toHaveText('正在准备海面与材质');
  const refreshPalette=await overlay(page).evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim());
  expect(refreshPalette).toMatch(/^#[\da-f]{6}$/i);
  await expect(page.locator('[data-cloud-status]')).toHaveCSS('background-image',/linear-gradient/);
  await expect.poll(()=>overlay(page).evaluate(el=>Number.parseFloat(getComputedStyle(el).getPropertyValue('--cloud-progress')))).toBeGreaterThan(0);
  releaseRefresh();gate=undefined;await expect(overlay(page)).toHaveAttribute('data-state','dismissing',{timeout:35000});
  await page.waitForTimeout(100);
  const fadeOpacity=Number(await overlay(page).evaluate(el=>getComputedStyle(el).opacity));
  expect(fadeOpacity).toBeGreaterThan(0);expect(fadeOpacity).toBeLessThan(1);
  await expect(overlay(page)).toBeHidden({timeout:15000});
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-ocean-active','true');
});

for(const path of ['/','/home','/works','/canvas','/os','/journal']) {
  test(`fresh ${path} preserves the requested route and refresh auto-fades`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`${path}?source=test#entry`);await ready(page);
    await expect(page.locator('[data-studio]')).toHaveAttribute('inert','');
    await enter(page);
    const expected=path==='/'?'/home':path;
    // /journal may select the default article; published slug links are tested below.
    if(path!=='/journal')await expect(page).toHaveURL(new RegExp(`${expected.replace('/','\\/')}\\?source=test#entry$`));
    await page.reload();await expect(overlay(page)).toBeHidden();
    const state=path==='/os'?'desktop':path==='/canvas'?'canvas':path==='/journal'?'journal':'room';
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state',state);
  });
}

test('camera and clouds share progress, survive resize, land without bounce and allow ordinary controls',async({page},info)=>{
  await page.clock.setFixedTime(new Date(2026,9,4,14));await page.goto('/home');await ready(page);
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.clock.runFor(350);
  await page.screenshot({path:info.outputPath('far-B.png')});
  await page.clock.runFor(700);
  await page.screenshot({path:info.outputPath('mid-reveal.png')});
  const progress=Number(await page.locator('[data-studio-scene]').getAttribute('data-entrance-progress'));
  expect(progress).toBeGreaterThan(.25);expect(progress).toBeLessThan(.5);
  await page.setViewportSize({width:390,height:844});
  await page.clock.runFor(600);await page.screenshot({path:info.outputPath('narrow-reveal.png')});
  await page.clock.runFor(1600);await expect(overlay(page)).toBeHidden();
  await page.screenshot({path:info.outputPath('narrow-settled.png')});
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-camera-angle','-0.4800');await expect(mount).toHaveAttribute('data-camera-zoom','1.0000');
  await page.clock.runFor(500);await expect(mount).toHaveAttribute('data-camera-angle','-0.4800');
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
});

test('WebGL denial exposes independent retry and usable content exits',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return /webgl/.test(type)?null:Reflect.apply(original,this,[type,...args]);} as typeof original;
  });
  await page.goto('/home');await expect(overlay(page)).toHaveAttribute('data-state','error');
  await expect(page.locator('[data-cloud-retry]')).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
  await page.locator('[data-cloud-error] a[href*="/os"]').click();
  await expect(overlay(page)).toBeHidden();await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','desktop');
});

test('standalone component needs no scene, slots are safe and disposed canvas releases its buffers',async({page,request},info)=>{
  const body=await (await request.get('/home')).text();
  const html=await page.evaluate(body=>new DOMParser().parseFromString(body,'text/html').querySelector('[data-cloud-entrance]')!.outerHTML,body);
  const css=await readFile('src/justin-kit/components/cloud-entrance/cloud-entrance.css','utf8');
  const timePalette=await readFile('src/justin-kit/components/cloud-entrance/timePalette.ts','utf8');
  const field=await readFile('src/justin-kit/components/cloud-entrance/fogField.ts','utf8');
  const runtime=(await readFile('src/justin-kit/components/cloud-entrance/runtime.ts','utf8'))
    .replace("import { createFogField } from './fogField';",'')
    .replace("import { entranceTimePalette, paletteHex } from './timePalette';",'');
  const paletteSource=ts.transpileModule(timePalette,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const fieldSource=ts.transpileModule(field,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace('const smooth =','const fieldSmooth =').replaceAll('smooth(', 'fieldSmooth(');
  const source=ts.transpileModule(runtime,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const demo=`${paletteSource}\n${fieldSource}\n${source}\nconst root=document.querySelector('[data-cloud-entrance]');
    root.querySelector('.cloud-entrance__information').innerHTML='<button data-cloud-no-enter>个人信息</button>';
    window.enterCount=0;window.cloud=createCloudEntrance(root,()=>{window.enterCount++;},()=>{});
    window.cloud.setProgress(.4);window.cloud.setState('loading');`;
  const htmlDocument=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${html}<script type="module">${demo}</script>`;
  await page.clock.setFixedTime(new Date(2026,9,5,1));
  await mkdir('.workspace/entrance-validation',{recursive:true});await writeFile('.workspace/entrance-validation/standalone.html',htmlDocument);
  await page.setContent(htmlDocument);
  await expect(overlay(page)).toHaveAttribute('data-state','loading');
  await expect(overlay(page)).toHaveAttribute('data-painted','true');
  const entrance=overlay(page);
  expect(await entrance.evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim())).toBe('#161e2e');
  await page.screenshot({path:info.outputPath('standalone-night.png')});
  await page.clock.setFixedTime(new Date(2026,9,5,12));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  expect(await entrance.evaluate(el=>getComputedStyle(el).getPropertyValue('--cloud-entrance-background').trim())).toBe('#c6d0d2');
  await page.screenshot({path:info.outputPath('standalone-day.png')});
  await page.evaluate(()=>Reflect.get(window,'cloud').setState('ready'));
  await ready(page);
  await page.getByRole('button',{name:'个人信息'}).click();
  expect(await page.evaluate(()=>Reflect.get(window,'enterCount'))).toBe(0);
  await overlay(page).focus();await page.keyboard.press('Space');
  expect(await page.evaluate(()=>Reflect.get(window,'enterCount'))).toBe(1);
  await page.screenshot({path:info.outputPath('standalone.png')});
  await overlay(page).dispatchEvent('pointerleave');
  await page.waitForTimeout(1200);
  const initial = await page.locator('[data-cloud-canvas]').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await page.evaluate(() => {
    Reflect.get(window, 'cloud').setState('revealing');
    Reflect.get(window, 'cloud').setRevealProgress(0);
  });
  expect(await page.locator('[data-cloud-canvas]').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(initial);
  for (const [label, hour] of [['day', 12], ['night', 1], ['dawn', 6], ['dusk', 18]] as const) {
    await page.clock.setFixedTime(new Date(2026, 9, 5, hour));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    for (const progress of [0, .15, .35, .6, .85]) {
      await page.evaluate(progress => Reflect.get(window, 'cloud').setRevealProgress(progress), progress);
      await page.screenshot({path:info.outputPath(`cloud-${label}-${progress}.png`)});
    }
  }
  await page.evaluate(()=>Reflect.get(window,'cloud').dispose());
  expect(await page.locator('[data-cloud-canvas]').evaluate(canvas=>(canvas as HTMLCanvasElement).width)).toBe(0);
});
