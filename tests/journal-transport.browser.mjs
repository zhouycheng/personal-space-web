import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1258,height:970}});
const base=process.env.JOURNAL_TEST_URL??'http://127.0.0.1:4323';
async function explore(){await page.locator('[data-studio-explore]').focus();await page.locator('[data-studio-explore]').click();}
async function record(action,stable){
  await page.evaluate(()=>{window.transportFrames=[];window.recordTransport=true;const frame=()=>{const m=document.querySelector('[data-studio-scene]'),c=m.querySelector('canvas');window.transportFrames.push({ready:m.dataset.journalDrawerReady,t:Number(c.dataset.journalTravel),position:c.dataset.journalPosition?.split(',').map(Number),scale:c.dataset.journalScale?.split(',').map(Number)});if(window.recordTransport)requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  await action();await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1);
  await page.clock.runFor(650);await page.screenshot({path:'.workspace/journal-checks/transport-'+stable+'-lift.png'});
  await page.clock.runFor(350);await page.screenshot({path:'.workspace/journal-checks/transport-'+stable+'-clear.png'});
  await page.clock.runFor(1400);
  await page.waitForFunction(s=>document.querySelector('[data-studio]').dataset.state===s,stable);
  const frames=await page.evaluate(()=>{window.recordTransport=false;return window.transportFrames;});await page.clock.resume();return frames;
}
function check(frames){
  const moving=frames.filter(f=>f.t>0&&f.t<.55&&f.position);
  assert.ok(moving.length>0,'transport must include the clearance stages: '+JSON.stringify(frames.map(f=>f.t)));
  for(const f of moving){assert.equal(f.ready,'true');assert.ok(Math.abs(f.scale[0]-.39)<1e-6,'book expands inside drawer');assert.ok(Math.abs(f.scale[1]-.47/(594/420))<1e-6);if(f.t<.28)assert.ok(Math.abs(f.position[2]+.22)<.002,'book crosses drawer wall during lift');else assert.ok(f.position[1]>=1.65&&f.position[2]>=-.221,'book approaches viewer before clearing the drawer');}
  assert.ok(moving.some(f=>f.position[1]>1.65),'book must clear the cabinet before rotating');
}
try{
  await page.goto(base+'/home');await page.waitForFunction(()=>document.querySelector('[data-studio-scene] canvas'));
  await page.clock.install();
  await explore();
  const entry=await record(()=>page.locator('[data-studio-action="diary"]').click(),'journal');check(entry);
  const exit=await record(()=>page.locator('[data-journal-close]').click(),'room');check(exit);
  await explore();assert.equal(await page.locator('[data-studio-action="drawer-top"]').getAttribute('aria-expanded'),'true');
  // Close the accessibility panel, then activate the real diary in the scene.
  await page.keyboard.press('Escape');
  await page.locator('[data-studio-close]').waitFor({state:'hidden'});
  const target=await page.locator('[data-studio-scene]').getAttribute('data-diary-target');assert.ok(target);
  const [x,y]=target.split(',').map(Number),rect=await page.locator('[data-studio-scene]').boundingBox();
  await page.mouse.move(rect.x+x,rect.y+y);await page.screenshot({path:'.workspace/journal-checks/drawer-hit.png'});
  assert.match(await page.locator('[data-studio-tooltip]').textContent(),/日记/);
  await page.mouse.click(rect.x+x,rect.y+y);await page.waitForURL('**/journal');
  await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='journal');
  await page.locator('[data-journal-close]').click();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');
  await page.goto(base+'/journal');await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='journal');
  await page.locator('[data-journal-close]').click();await page.waitForFunction(()=>document.querySelector('[data-studio]').dataset.state==='room');
  assert.equal(await page.locator('[data-studio-scene]').getAttribute('data-journal-drawer-ready'),'true');
  console.log('Transport passed: drawer opens before pickup, fixed-size vertical clearance in both directions, real scene hit, drawer remains open and direct-route return.');
}finally{await browser.close();}
