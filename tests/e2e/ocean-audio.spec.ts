import {expect,type Page} from 'playwright/test';
import {test,studioDestination} from './helpers/app';

async function observeAudio(page:Page,blockedUntilGesture=false) {
  await page.addInitScript(blockedUntilGesture=>{
    const Native=window.AudioContext;
    let allowed=!blockedUntilGesture;
    addEventListener('click',event=>{if(event.isTrusted)allowed=true;},{capture:true});
    const probe={contexts:[] as AudioContext[],sources:0,decodes:0,bytes:0,seconds:0};
    Object.assign(window,{oceanProbe:probe});
    window.AudioContext=class extends Native {
      constructor(options?:AudioContextOptions){super(options);probe.contexts.push(this);}
      get state(){return allowed?super.state:'suspended';}
      resume(){return allowed?super.resume():Promise.reject(new DOMException('Gesture required','NotAllowedError'));}
      createBufferSource(){probe.sources++;return super.createBufferSource();}
      async decodeAudioData(bytes:ArrayBuffer,...callbacks:Parameters<AudioContext['decodeAudioData']> extends [ArrayBuffer,...infer Rest]?Rest:never){
        probe.decodes++;
        const buffer=await super.decodeAudioData(bytes,...callbacks);probe.bytes=buffer.length*buffer.numberOfChannels*4;probe.seconds=buffer.duration;return buffer;
      }
    };
  },blockedUntilGesture);
}
async function openAudio(page:Page) {
  await page.locator('[data-studio-explore]').click();
  await page.getByRole('tab',{name:'音乐',exact:true}).click();
}

test('first cloud gesture unlocks one sea loop; routes, rapid navigation and settings retain it',async({page})=>{
  test.setTimeout(90000);
  await observeAudio(page);
  await page.addInitScript(()=>{if(!sessionStorage.getItem('ocean-test-visited')){sessionStorage.removeItem('justin-entrance-completed');sessionStorage.setItem('ocean-test-visited','1');}});
  await page.goto('/home');
  await expect(page.locator('[data-cloud-status]')).toHaveText('点击拨开云雾',{timeout:35000});
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(0);
  await page.locator('[data-cloud-entrance]').click();
  const audio=page.locator('[data-ocean-audio]');
  await expect(audio).toHaveAttribute('data-state','playing',{timeout:15000});
  const decoded=await page.evaluate(()=>({sources:(window as any).oceanProbe.sources,decodes:(window as any).oceanProbe.decodes,bytes:(window as any).oceanProbe.bytes,seconds:(window as any).oceanProbe.seconds}));
  expect(decoded.sources).toBe(1);expect(decoded.decodes).toBe(1);expect(decoded.seconds).toBeCloseTo(24,1);expect(decoded.bytes).toBeLessThan(7*1024*1024);
  for(const [action,exit] of [['canvas','[data-canvas-return]'],['works','[data-gallery-return]'],['diary','[data-journal-close]'],['computer','[data-studio-return]']] as const){
    await (await studioDestination(page,action)).click();await expect(page.locator(exit)).toBeVisible();
    await expect(audio).toHaveAttribute('data-state','paused');
    await expect.poll(()=>page.evaluate(()=>(window as any).oceanProbe.contexts[0].state)).toBe('suspended');
    await page.locator(exit).click();await expect(audio).toHaveAttribute('data-state','playing');
  }
  await (await studioDestination(page,'canvas')).click();await page.goBack();
  await expect(audio).toHaveAttribute('data-state','playing');
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(1);
  expect(await page.evaluate(()=>(window as any).oceanProbe.decodes)).toBe(1);
  await openAudio(page);
  await page.locator('[data-ocean-volume]').fill('0.31');
  await expect(page.locator('[data-ocean-output]')).toHaveText('31%');
  await page.locator('[data-ocean-toggle]').click();await expect(audio).toHaveAttribute('data-state','paused');
  await page.reload();
  await expect(page.locator('[data-studio-explore]')).toBeVisible({timeout:35000});
  await openAudio(page);await expect(page.locator('[data-ocean-toggle]')).toHaveAttribute('aria-checked','false');
  await expect(page.locator('[data-ocean-output]')).toHaveText('31%');
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(0);
  await page.locator('[data-ocean-toggle]').click();await expect(audio).toHaveAttribute('data-state','playing');
  await page.keyboard.press('Escape');await expect(page.locator('[data-studio-explore]')).toBeFocused();
});

test('failed sea audio waits for explicit retry and remains separate from BGM',async({page})=>{
  await observeAudio(page);let requests=0,broken=true;
  await page.route('**/audio/ocean.m4a',route=>{requests++;return broken?route.fulfill({status:404,body:''}):route.continue();});
  await page.goto('/home');await expect(page.locator('[data-studio-explore]')).toBeVisible({timeout:35000});await openAudio(page);
  const audio=page.locator('[data-ocean-audio]');await expect(audio).toHaveAttribute('data-state','error');
  await page.keyboard.press('Escape');await openAudio(page);expect(requests).toBe(1);
  broken=false;await page.locator('[data-ocean-retry]').click();await expect(audio).toHaveAttribute('data-state','playing');expect(requests).toBe(2);
  await expect(page.locator('[data-bgm]')).toHaveAttribute('data-playing','false');
  await page.keyboard.press('Escape');await page.goBack();
});

test('direct content stays silent; visibility lifecycle suspends and resumes the same source',async({page})=>{
  await observeAudio(page);await page.goto('/os');
  await expect(page.locator('[data-studio-return]')).toBeVisible({timeout:35000});
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(0);
  await page.locator('[data-studio-return]').click();
  await expect(page.locator('[data-studio-explore]')).toBeVisible();await openAudio(page);
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','playing');
  // Headless WebKit keeps every tab visible. Exercise the lifecycle handler explicitly;
  // real background-tab suspension is checked separately with the native-page fixture.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.evaluate(()=>(window as any).oceanProbe.contexts[0].state)).toBe('suspended');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','playing');
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(1);
});

test('a blocked refresh waits for a real homepage gesture without another entrance prompt',async({page})=>{
  await observeAudio(page,true);
  await page.goto('/home');
  await expect(page.locator('[data-cloud-entrance]')).toBeHidden({timeout:35000});
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','blocked');
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(0);
  await openAudio(page);
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','playing');
  expect(await page.evaluate(()=>(window as any).oceanProbe.sources)).toBe(1);
});
