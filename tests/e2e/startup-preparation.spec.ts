import { test,expect } from 'playwright/test';

test('preparation paints each real stage and home does not fetch the canvas editor',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.addInitScript(()=>{
    const stages:string[]=[];Reflect.set(window,'paintedStages',stages);
    const observe=()=>{
      const root=document.querySelector<HTMLElement>('[data-cloud-entrance]');if(!root)return;
      new MutationObserver(()=>{requestAnimationFrame(()=>{const stage=root.dataset.stage;if(stage&&stages.at(-1)!==stage)stages.push(stage);});}).observe(root,{attributes:true,attributeFilter:['data-stage']});
    };
    document.addEventListener('DOMContentLoaded',observe);
  });
  await page.goto('/home');await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-state','ready',{timeout:35000});
  expect(await page.evaluate(()=>Reflect.get(window,'paintedStages'))).toEqual(expect.arrayContaining(['geometry','texture','shader','first-frame']));
  expect(requests.some(url=>/canvas-flow|MineCanvasEditor/.test(url))).toBe(false);
  const timing=JSON.parse((await page.locator('[data-studio-scene]').getAttribute('data-startup-timings'))!);
  expect(timing.geometryWorker).toBeGreaterThan(0);expect(timing.workerFallback).toBeUndefined();
  await page.keyboard.press('Enter');await expect(page.locator('[data-cloud-entrance]')).toBeHidden();
});

test('a failed geometry worker falls back to the same scene and can enter',async({page})=>{
  await page.addInitScript(()=>{window.Worker=class {constructor(){throw new Error('Worker unavailable for test');}} as unknown as typeof Worker;});
  await page.goto('/home');await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-state','ready',{timeout:35000});
  const timing=JSON.parse((await page.locator('[data-studio-scene]').getAttribute('data-startup-timings'))!);
  expect(timing.workerFallback).toBe(1);await page.keyboard.press('Enter');await expect(page.locator('[data-cloud-entrance]')).toBeHidden();
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active','true');
});

test('a stalled optional normal map times out and a late response remains safe',async({page})=>{
  test.setTimeout(60000);let release!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/*waternormals*',async route=>{await gate;await route.continue().catch(()=>{});});
  try {
    await page.goto('/home',{waitUntil:'domcontentloaded'});
    await expect(page.locator('[data-cloud-status]')).toHaveText('正在准备海面与材质',{timeout:15000});
    await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-state','ready',{timeout:25000});
    await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-normals-wait','timeout');
    release();await page.keyboard.press('Enter');await expect(page.locator('[data-cloud-entrance]')).toBeHidden();
    await expect(page.locator('[data-studio-scene] canvas')).toBeVisible();
  }finally{release();}
});

test('navigation during geometry preparation cancels stale work and preserves the new target',async({page})=>{
  await page.goto('/home',{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-stage','geometry');
  await page.evaluate(()=>{history.pushState({},'', '/os');dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-state','ready',{timeout:35000});
  await page.keyboard.press('Enter');await expect(page.locator('[data-cloud-entrance]')).toBeHidden();
  await expect(page).toHaveURL(/\/os$/);await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','desktop');
  await expect(page.locator('[data-studio-scene] canvas')).toHaveCount(1);
});

test('normal-map failure prepares the analytic sea and unloading terminates a pending worker',async({page})=>{
  await page.route('**/*waternormals*',route=>route.abort());
  await page.goto('/home');await expect(page.locator('[data-cloud-entrance]')).toHaveAttribute('data-state','ready',{timeout:35000});
  await page.keyboard.press('Enter');await expect(page.locator('[data-cloud-entrance]')).toBeHidden();
  await page.addInitScript(()=>{
    const NativeWorker=Worker,stats={created:0,terminated:0};Reflect.set(window,'workerLifecycle',stats);
    window.Worker=class extends NativeWorker{
      constructor(url:string|URL,options?:WorkerOptions){super(url,options);stats.created++;}
      terminate(){stats.terminated++;super.terminate();}
    };
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'workerLifecycle').created)).toBe(1);
  await page.locator('.alpha-shell').evaluate(shell=>shell.remove());
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'workerLifecycle').terminated)).toBe(1);
  await expect(page.locator('[data-studio-scene] canvas')).toHaveCount(0);
});
