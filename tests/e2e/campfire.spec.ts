import { expect, type Page } from 'playwright/test';
import { test } from './helpers/app';
import sharp from 'sharp';

async function ready(page: Page) {
  await page.addInitScript(() => {
    const target=new EventTarget();
    (window as any).__THREE_DEVTOOLS__=target;
    target.addEventListener('observe',event=>{
      const scene=(event as CustomEvent).detail;
      if(scene.isWebGLRenderer)(window as any).__campfireRenderer=scene;
      if(scene.isScene){(window as any).__campfireScene=scene;scene.onBeforeRender=(_renderer:unknown,_scene:unknown,camera:unknown)=>{(window as any).__campfireCamera=camera;};}
    });
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.setFixedTime(new Date(2026,9,12,0,15));
  await page.goto('/home');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active','true',{timeout:35000});
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-campfire-stock','12');
  await page.clock.install({time:new Date(2026,9,12,0,15)});
  await page.clock.pauseAt(new Date(2026,9,12,0,15,1));
}

async function rackPoint(page:Page) {
  const candidates=await page.evaluate(()=>{
    const scene=(window as any).__campfireScene,camera=(window as any).__campfireCamera;
    const rack=scene.getObjectByName('firewood'),rect=document.querySelector('[data-studio-scene] canvas')!.getBoundingClientRect();
    return [.54,.39,.245,.14].flatMap(y=>[-.32,-.16,0,.16,.32].map(x=>{
      const point=rack.localToWorld(rack.position.clone().set(x,y,.247)).project(camera);
      return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
    }));
  });
  for(const point of candidates){
    await page.mouse.move(point.x,point.y);
    await page.clock.runFor(20);
    try{await expect(page.locator('[data-studio-tooltip]')).toContainText('木柴',{timeout:350});return point;}catch{}
  }
  throw new Error('No visible rack surface could be activated from the current camera');
}

test('rack click, drag rejection, keyboard fuel and gradual burn share one state',async({page,isMobile},info)=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await ready(page);const mount=page.locator('[data-studio-scene]');
  await page.screenshot({path:info.outputPath('night-initial.png')});
  const point=await rackPoint(page);
  if(isMobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  await page.clock.runFor(20);
  await expect(mount).toHaveAttribute('data-campfire-stock','11');await expect(mount).toHaveAttribute('data-campfire-burning','4');
  const drag=await rackPoint(page);await page.mouse.move(drag.x,drag.y);await page.mouse.down();
  await page.mouse.move(drag.x+20,drag.y+5);await page.mouse.move(drag.x,drag.y);await page.mouse.up();
  await expect(mount).toHaveAttribute('data-campfire-stock','11');
  await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-tab="objects"]').click();
  const add=page.getByRole('button',{name:'添一根柴',exact:true});await add.focus();
  await page.keyboard.press('Enter');await page.keyboard.press('Space');await page.keyboard.press('Enter');
  await expect(mount).toHaveAttribute('data-campfire-stock','8');await expect(mount).toHaveAttribute('data-campfire-burning','7');
  await expect(add).toBeDisabled();await expect(page.locator('[data-firewood-status]')).toContainText('火塘已满');
  await page.keyboard.press('Escape');
  await page.clock.runFor(50);
  const heat=Number(await mount.getAttribute('data-campfire-heat'));
  await page.clock.fastForward(4000);await page.clock.runFor(50);
  const middle=Number(await mount.getAttribute('data-campfire-heat'));expect(middle).toBeGreaterThan(heat);
  await page.screenshot({path:info.outputPath('night-igniting.png')});
  await page.clock.fastForward(4000);await page.clock.runFor(50);
  expect(Number(await mount.getAttribute('data-campfire-heat'))).toBeGreaterThan(middle);
  await page.screenshot({path:info.outputPath('night-full.png')});
  await page.clock.fastForward(3000);await page.clock.runFor(50);await expect(mount).toHaveAttribute('data-campfire-stock','9');
  await page.clock.fastForward(180000);await page.clock.runFor(50);
  await expect(mount).toHaveAttribute('data-campfire-burning','0');expect(Number(await mount.getAttribute('data-campfire-heat'))).toBe(0);
  await page.clock.fastForward(1000);await page.clock.runFor(50);
  await page.screenshot({path:info.outputPath('night-embers.png')});
  await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-tab="objects"]').click();
  await expect(add).toBeEnabled();await add.click();await expect(mount).toHaveAttribute('data-campfire-burning','1');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.querySelector('[data-studio-scene]')!.dispatchEvent(new CustomEvent('studio-time-preview',{detail:10})));
  await page.clock.runFor(50);await page.screenshot({path:info.outputPath('day-refuel.png')});
  await page.clock.resume();await page.reload();
  await expect(mount).toHaveAttribute('data-render-active','true',{timeout:35000});
  await expect(mount).toHaveAttribute('data-campfire-stock','12');
  await expect(mount).toHaveAttribute('data-campfire-burning','3');expect(errors).toEqual([]);
});

test('scene rebuild restores wood inventory and partially burned fuel',async({page})=>{
  test.setTimeout(90000);await ready(page);
  const mount=page.locator('[data-studio-scene]');
  await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-tab="objects"]').click();
  await page.getByRole('button',{name:'添一根柴',exact:true}).click();await page.keyboard.press('Escape');
  await page.clock.runFor(50);await page.clock.fastForward(2000);await page.clock.runFor(50);
  const stock=await mount.getAttribute('data-campfire-stock'),ages=await mount.getAttribute('data-campfire-logs');
  const wood=await page.evaluate(()=>(window as any).__campfireScene.getObjectByName('campfire-logs').children.map((mesh:any)=>({visible:mesh.visible,position:mesh.position.toArray(),scale:mesh.scale.toArray(),rotation:mesh.quaternion.toArray()})));
  const lost=await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-studio-scene] canvas')!,gl=canvas.getContext('webgl2')!,extension=gl.getExtension('WEBGL_lose_context');
    if(!extension)return false;(window as any).__oldCampfireCanvas=canvas;extension.loseContext();return true;
  });
  expect(lost).toBe(true);await expect(page.locator('[data-studio]')).toHaveClass(/is-fallback/);
  await page.clock.fastForward(15000);await page.clock.runFor(50);
  await expect.poll(()=>page.evaluate(()=>document.querySelector('[data-studio-scene] canvas')!==(window as any).__oldCampfireCanvas),{timeout:35000}).toBe(true);
  await expect(mount).toHaveAttribute('data-render-active','true',{timeout:35000});
  await expect(mount).toHaveAttribute('data-campfire-stock',stock!);expect(await mount.getAttribute('data-campfire-logs')).toBe(ages);
  expect(await page.evaluate(()=>(window as any).__campfireScene.getObjectByName('campfire-logs').children.map((mesh:any)=>({visible:mesh.visible,position:mesh.position.toArray(),scale:mesh.scale.toArray(),rotation:mesh.quaternion.toArray()})))).toEqual(wood);
  await expect(mount.locator('canvas')).toHaveCount(1);
});

test('animated fuel settles, chars and keeps fixed flame and charcoal resources',async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width:640,height:400});await ready(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-tab="objects"]').click();
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'添一根柴',exact:true}).click();
  await page.keyboard.press('Escape');await page.clock.runFor(20);
  const inspect=()=>page.evaluate(()=>{
    const scene=(window as any).__campfireScene,group=scene.getObjectByName('campfire-logs'),batch=scene.getObjectByName('campfire-flame-batch');
    return {heights:group.children.map((m:any)=>m.position.y),visible:group.children.filter((m:any)=>m.visible).length,
      burn:group.children.map((m:any)=>m.userData.burn),fractures:group.children.map((m:any)=>m.morphTargetInfluences[0]),
      particles:batch.batches[0].geometry.instanceCount,tiles:Array.from(batch.batches[0].geometry.attributes.uvTile.array).slice(0,5)};
  });
  const dropping=await inspect();expect(dropping.visible).toBeLessThan(7);
  // Step once per active 100 ms; software WebGL need not render every intermediate frame.
  for(let i=0;i<18;i++){await page.clock.fastForward(100);await page.clock.runFor(1);}
  const settled=await inspect();expect(settled.visible).toBe(7);expect(settled.particles).toBe(5);
  expect(settled.tiles).not.toEqual(dropping.tiles);
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(20);const still=await inspect();
  await page.clock.fastForward(125000);await page.clock.runFor(20);const charred=await inspect();
  expect(charred.tiles).toEqual(still.tiles);expect(charred.fractures.every((n:number)=>n>.15)).toBe(true);
  expect(charred.heights.every((y:number,i:number)=>y<=settled.heights[i])).toBe(true);
  await page.clock.fastForward(60000);await page.clock.runFor(20);
  expect((await inspect()).burn.every((n:number)=>n===1)).toBe(true);
});

test('missing flame texture leaves the scene and fuel interaction usable',async({page})=>{
  await page.route('**/flame-atlas*.png',route=>route.fulfill({status:404,body:''}));await ready(page);
  expect(await page.evaluate(()=>(window as any).__campfireScene.getObjectByName('campfire-static-ember-flame').visible)).toBe(true);
  await page.locator('[data-studio-explore]').click();await page.locator('[data-studio-tab="objects"]').click();
  await page.getByRole('button',{name:'添一根柴',exact:true}).click();
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-campfire-stock','11');
});

test('the rendered wood surface darkens to charcoal as its own fuel ages',async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width:640,height:480});await ready(page);
  await page.evaluate(()=>document.querySelector('[data-studio-scene]')!.dispatchEvent(new CustomEvent('studio-time-preview',{detail:10})));
  await page.clock.runFor(40);
  const capture=async(name:string)=>{
    await page.evaluate(()=>{
      const scene=(window as any).__campfireScene,renderer=(window as any).__campfireRenderer,wood=scene.getObjectByName('campfire-log-0');
      const visibility:any[]=[];scene.traverse((o:any)=>{if(o.isMesh||o.isPoints||o.isLine){visibility.push([o,o.visible]);o.visible=o===wood;}});
      const background=scene.background;scene.background=wood.material.color.clone().set(0);
      const camera=(window as any).__campfireCamera.clone(),point=wood.getWorldPosition(wood.position.clone());
      camera.position.set(point.x+.45,point.y+1.0,point.z+1.4);camera.lookAt(point);camera.updateMatrixWorld(true);
      renderer.render(scene,camera);(window as any).__restoreWoodView=()=>{scene.background=background;visibility.forEach(([o,visible])=>o.visible=visible);};
    });
    const png=await page.locator('[data-studio-scene] canvas').screenshot({path:info.outputPath(name+'.png')});
    await page.evaluate(()=>(window as any).__restoreWoodView());return (await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true})).data;
  };
  const fresh=await capture('fresh-wood');
  await page.clock.fastForward(55000);await page.clock.runFor(40);const coal=await capture('charcoal-wood');
  let freshLight=0,coalLight=0,pixels=0;
  for(let i=0;i<fresh.length;i+=3){const a=fresh[i]*.2126+fresh[i+1]*.7152+fresh[i+2]*.0722;if(a<35)continue;freshLight+=a;coalLight+=coal[i]*.2126+coal[i+1]*.7152+coal[i+2]*.0722;pixels++;}
  expect(pixels).toBeGreaterThan(100);expect(coalLight/freshLight).toBeLessThan(.55);
});
