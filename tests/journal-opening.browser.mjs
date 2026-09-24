import {chromium} from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1258,height:970}});
const base=process.env.JOURNAL_TEST_URL??'http://127.0.0.1:4323';
const phase=()=>page.locator('canvas[data-journal-phase]').getAttribute('data-journal-phase');
await mkdir('.workspace/journal-checks',{recursive:true});
try{
  await page.goto(base+'/journal');
  await page.waitForFunction(()=>document.querySelector('canvas[data-journal-phase]')?.dataset.journalPhase==='observing');
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  for(const action of ['open','fold']){
    const emptyLeftArea=action==='open'
      ? await sharp(await page.screenshot()).extract({left:200,top:420,width:30,height:100}).raw().toBuffer()
      : undefined;
    await page.locator('[data-journal-'+action+']').evaluate(el=>el.click());
    await page.clock.runFor(375);
    assert.equal(await phase(),action==='open'?'opening':'closing');
    const screenshot=await page.screenshot({path:'.workspace/journal-checks/'+action+'-midpoint.png'});
    // The empty scene area must stay unchanged; the left paper block belongs beside the cover.
    if(emptyLeftArea){
      const openedLeftArea=await sharp(screenshot).extract({left:200,top:420,width:30,height:100}).raw().toBuffer();
      let changed=0;for(let i=0;i<emptyLeftArea.length;i++)if(Math.abs(emptyLeftArea[i]-openedLeftArea[i])>12)changed++;
      assert.ok(changed<emptyLeftArea.length*0.01,'the left pages must not detach into the empty scene area');
    }
    await page.clock.runFor(500);
    assert.equal(await phase(),action==='open'?'reading':'observing');
  }
  for(let i=0;i<3;i++){
    await page.locator('[data-journal-open]').evaluate(el=>el.click());await page.clock.runFor(250);
    await page.keyboard.press('Escape');await page.clock.runFor(850);
    assert.equal(await phase(),'observing');
  }
  await page.locator('[data-journal-reset]').evaluate(el=>el.click());await page.clock.runFor(32);
  await page.mouse.move(620,440);await page.mouse.down();await page.mouse.move(620,660,{steps:20});await page.mouse.up();await page.clock.runFor(32);
  const side=await page.screenshot({path:'.workspace/journal-checks/closed-side.png'});
  const {data,info}=await sharp(side).extract({left:600,top:450,width:20,height:35}).raw().toBuffer({resolveWithObject:true});
  let darkRows=0;
  for(let y=0;y<info.height;y++){let red=0;for(let x=0;x<info.width;x++)red+=data[(y*info.width+x)*info.channels];if(red/info.width<100)darkRows++;}
  assert.ok(darkRows<=3,'closed paper block exposes a gap wider than the paper seam');
  assert.equal(await phase(),'observing');
  console.log('Opening regression passed: synchronized cover/pages, both midpoints, complete opening/closing, repeated interruption and solid closed side.');
}finally{await browser.close();}
