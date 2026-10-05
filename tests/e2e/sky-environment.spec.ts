import { expect,test } from 'playwright/test';

const cover='[data-cloud-entrance]';
const cases=[['night','2026-10-05T01:00:00+08:00'],['predawn','2026-10-05T05:20:00+08:00'],['sunrise','2026-10-05T06:00:00+08:00'],['noon','2026-10-05T12:00:00+08:00'],['afternoon','2026-10-05T15:00:00+08:00'],['sunset','2026-10-05T17:10:00+08:00'],['twilight','2026-10-05T18:00:00+08:00']] as const;
for(const [label,date] of cases)test(`sky and entrance: ${label}`,async({page},info)=>{
  test.setTimeout(60_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date(date));await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/home');await expect(page.locator(cover)).toHaveAttribute('data-state','ready',{timeout:45000});
  const palette=await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'));
  const initial=await page.evaluate(()=>document.documentElement.style.getPropertyValue('--environment-background'));
  expect(palette).toBe(initial);
  await page.screenshot({path:info.outputPath(`${label}-clouds.png`)});
  await page.locator(cover).focus();await page.keyboard.press('Enter');await expect(page.locator(cover)).toBeHidden();
  await expect(page.locator('[data-sky-open]')).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`${label}-sky.png`)});
  expect(errors).toEqual([]);
});

test('head palette precedes scene scripts and respects the saved representative region',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T01:00:00+08:00'));
  await page.addInitScript(()=>localStorage.setItem('justin-sky-region','west'));
  await page.route('**/_astro/*.js',route=>route.abort());
  await page.goto('/home');
  const background=await page.locator(cover).evaluate(el=>getComputedStyle(el).backgroundColor);
  const channels=background.match(/\d+/g)!.map(Number);
  expect(Math.max(...channels)).toBeLessThan(80);
  await expect(page.locator(cover)).not.toHaveAttribute('data-painted','true');
});

test('waiting clouds catch up after visibility restore and reveal without leftover cover',async({page},info)=>{
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
  await page.goto('/home');await expect(page.locator(cover)).toHaveAttribute('data-state','ready',{timeout:45000});
  const day=await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.setFixedTime(new Date('2026-10-05T01:00:00+08:00'));
  await page.waitForTimeout(1100);
  expect(await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'))).toBe(day);
  await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('.alpha-shell')).toHaveAttribute('data-sky-phase','night');
  expect(await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'))).not.toBe(day);
  await page.locator(cover).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const p=Number(document.querySelector<HTMLElement>('[data-studio-scene]')?.dataset.entranceProgress);return p>.25&&p<.8;});
  await page.screenshot({path:info.outputPath('night-mid-reveal.png')});
  await expect(page.locator(cover)).toBeHidden({timeout:15000});
  await page.reload();await expect(page.locator(cover)).toBeHidden({timeout:45000});
  await expect(page.locator('.alpha-shell')).toHaveAttribute('data-sky-phase','night');
});

test('failed scene preparation keeps themed loading controls and retry recovers',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T01:00:00+08:00'));
  await page.addInitScript(()=>{
    Reflect.set(window,'denySkyContext',true);const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return /webgl/.test(type)&&Reflect.get(window,'denySkyContext')?null:Reflect.apply(original,this,[type,...args]);} as typeof original;
  });
  await page.goto('/home');await expect(page.locator(cover)).toHaveAttribute('data-state','error');
  const background=await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'));
  await page.evaluate(()=>Reflect.set(window,'denySkyContext',false));
  await page.locator('[data-cloud-retry]').click();await expect(page.locator(cover)).toHaveAttribute('data-state','ready',{timeout:45000});
  expect(await page.locator(cover).evaluate(el=>el.style.getPropertyValue('--cloud-entrance-background'))).toBe(background);
});

test('shadow direction follows time and background suspension stops scene submissions',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00+08:00'));await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const events=new EventTarget();Reflect.set(window,'__THREE_DEVTOOLS__',events);Reflect.set(window,'skyFrames',0);
    events.addEventListener('observe',event=>{
      const object=(event as CustomEvent).detail;
      if(object.isScene)Reflect.set(window,'skyTestScene',object);
      if(object.isWebGLRenderer){const render=object.render;object.render=function(...args:unknown[]){Reflect.set(window,'skyFrames',Reflect.get(window,'skyFrames')+1);return render.apply(this,args);};}
    });
  });
  await page.goto('/home');await expect(page.locator(cover)).toHaveAttribute('data-state','ready',{timeout:45000});
  await page.locator(cover).focus();await page.keyboard.press('Enter');await expect(page.locator(cover)).toBeHidden();
  const light=()=>page.evaluate(()=>{
    let result={x:0,y:0,intensity:0,map:0};
    Reflect.get(window,'skyTestScene').traverse((object:{isDirectionalLight:boolean;position:{x:number;y:number};target:{position:{x:number;y:number}};intensity:number;shadow:{map:{width:number}}})=>{
      if(object.isDirectionalLight)result={x:object.position.x-object.target.position.x,y:object.position.y-object.target.position.y,intensity:object.intensity,map:object.shadow.map?.width};
    });return result;
  });
  expect((await light()).x).toBeGreaterThan(0);expect((await light()).map).toBe(2048);
  await page.clock.setFixedTime(new Date('2026-10-05T15:00:00+08:00'));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  expect((await light()).x).toBeLessThan(0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);await page.evaluate(()=>Reflect.set(window,'skyFrames',0));await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>Reflect.get(window,'skyFrames'))).toBe(0);
  await page.clock.setFixedTime(new Date('2026-10-05T01:00:00+08:00'));
  await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  const night=await light();expect(night.intensity).toBeLessThan(.21);if(night.intensity>0)expect(night.y).toBeGreaterThan(0);
});
