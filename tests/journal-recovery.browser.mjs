import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.JOURNAL_TEST_URL??'http://127.0.0.1:4321';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settled=()=>page.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]')?.dataset.journalPhase==='reading'&&document.querySelector('canvas[data-journal-busy]')?.dataset.journalBusy==='false');
const observing=()=>page.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]')?.dataset.journalPhase==='observing'&&!document.querySelector('[data-journal-root]').classList.contains('is-entering'));
try{
  const manifest=await(await page.request.get(base+'/journal/generated/manifest.json')).json();
  const slug=encodeURIComponent(manifest.articles[0].slug),count=manifest.pages.length;
  // Six faces exercise physical-sheet turns independently of the published article length.
  const fixture={...manifest,pages:Array.from({length:6},(_,i)=>({...manifest.pages[i%count],index:i})),articles:[{...manifest.articles[0],count:6}]};
  await page.route('**/journal',async route=>{
    const response=await route.fetch();const html=(await response.text()).replace(/(<script[^>]*data-journal-manifest[^>]*>)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(fixture).replace(/</g,'\\u003c')+b);
    await route.fulfill({response,body:html});
  });
  await page.goto(base+'/journal');await observing();await page.locator('[data-journal-open]').click();await settled();
  await page.waitForFunction(()=>document.querySelector('canvas[data-journal-textures]').dataset.journalTextures==='6');
  await page.locator('[data-journal-reset]').click();
  const drag=async(from,to)=>{await page.mouse.move(from,790);await page.mouse.down();await page.mouse.move(to,790,{steps:12});};
  await drag(1150,1120);assert.equal(await page.locator('canvas[data-journal-busy]').getAttribute('data-journal-busy'),'true');
  await page.mouse.up();await settled();assert.equal(await page.locator('canvas[data-journal-page]').getAttribute('data-journal-page'),'0');
  await drag(1150,810);await page.screenshot({path:'.workspace/journal-checks/inspection-double-turn.png'});await page.mouse.up();await settled();
  assert.equal(await page.locator('canvas[data-journal-page]').getAttribute('data-journal-page'),'2');
  await drag(285,625);await page.mouse.up();await settled();assert.equal(await page.locator('canvas[data-journal-page]').getAttribute('data-journal-page'),'0');
  await drag(1150,1080);await page.locator('canvas[data-journal-page]').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await settled();
  assert.equal(await page.locator('canvas[data-journal-page]').getAttribute('data-journal-page'),'0');
  for(let i=0;i<3;i++){
    await page.locator('[data-journal-close]').click();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');
    assert.equal(await page.locator('canvas[data-journal-textures]').getAttribute('data-journal-textures'),'0');
    await page.locator('[data-studio-explore]').focus();await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-action="diary"]').click();
    if(i===0){await page.waitForTimeout(180);await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');await page.goForward();}
    await observing();
    if(i===1){await page.locator('[data-journal-open]').click();await page.waitForTimeout(100);await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');await page.goForward();await observing();}
  }
  await page.unroute('**/journal');
  for(const [route,state] of [['/','room'],['/home','room'],['/works','room'],['/canvas','canvas'],['/os','desktop'],['/journal','journal']]){
    await page.goto(base+route);await page.waitForFunction(expected=>document.querySelector('[data-studio]')?.dataset.state===expected,state);
    await page.reload();await page.waitForFunction(expected=>document.querySelector('[data-studio]')?.dataset.state===expected,state);
  }
  await context.close();
  const lost=await browser.newContext(),lostPage=await lost.newPage();
  await lostPage.goto(base+'/journal/'+slug);
  await lostPage.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]')?.dataset.journalPhase==='reading');
  await lostPage.locator('canvas[data-journal-phase]').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await lostPage.waitForFunction(()=>document.querySelector('[data-journal-text]').hidden===false);
  await lostPage.locator('[data-journal-mode]').click();assert.equal(await lostPage.locator('[data-journal-text]').isVisible(),true);
  await lostPage.locator('[data-journal-close]').click();await lostPage.waitForURL('**/home');
  await lostPage.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');await lost.close();
  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const mobile=await reduced.newPage();await mobile.goto(base+'/journal/'+slug);
  await mobile.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]')?.dataset.journalPhase==='reading');
  await mobile.waitForFunction(count=>Number(document.querySelector('canvas[data-journal-textures]').dataset.journalTextures)===count,count);
  await mobile.locator('[data-journal-next]').click();await mobile.waitForFunction(()=>document.querySelector('canvas[data-journal-page]').dataset.journalPage==='1'&&document.querySelector('canvas[data-journal-busy]').dataset.journalBusy==='false');
  await mobile.keyboard.press('Escape');await mobile.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]').dataset.journalPhase==='observing');await reduced.close();
  const failed=await browser.newContext(),fallback=await failed.newPage();
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
  await fallback.goto(base+'/journal');await fallback.waitForFunction(()=>document.querySelector('[data-journal-text]')?.hidden===false);
  assert.match(await fallback.locator('[data-journal-text]').textContent(),/生活节奏/);await fallback.locator('[data-journal-close]').click();await fallback.waitForURL('**/home');await failed.close();
  const missing=await browser.newContext(),retry=await missing.newPage();
  await retry.route('**/journal/generated/*@2x.webp',route=>route.abort());await retry.goto(base+'/journal/'+slug);
  await retry.locator('[data-journal-retry]').waitFor({state:'visible'});await retry.locator('[data-journal-mode]').click();assert.equal(await retry.locator('[data-journal-text]').isVisible(),true);
  await retry.unroute('**/journal/generated/*@2x.webp');await retry.locator('[data-journal-retry]').click();await retry.waitForFunction(count=>Number(document.querySelector('canvas[data-journal-textures]').dataset.journalTextures)===count,count);
  await retry.locator('[data-journal-mode]').click();assert.equal(await retry.locator('[data-journal-text]').isVisible(),false);await missing.close();
  assert.deepEqual(errors,[]);
  console.log('Recovery passed: double-page drag/cancel/reverse, release, interrupted entry/opening, shell routes/refresh, reduced motion, WebGL fallback and texture retry.');
}finally{await browser.close();}
