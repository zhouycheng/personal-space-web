import { expect } from 'playwright/test';
import { test, studioDestination } from './helpers/app';

test('device entry and return keep finite camera poses throughout both flights', async ({ page }) => {
  await page.addInitScript(() => {
    const host=window as typeof window & {__THREE_DEVTOOLS__:EventTarget;__invalidCamera?:boolean};
    host.__THREE_DEVTOOLS__=new EventTarget();
    host.__THREE_DEVTOOLS__.addEventListener('observe',event=>{
      const renderer=(event as CustomEvent).detail;if(!renderer.isWebGLRenderer)return;
      const render=renderer.render;
      renderer.render=function(...args:unknown[]){
        const camera=args[1] as {position:{toArray():number[]};quaternion:{toArray():number[]}};
        if(![...camera.position.toArray(),...camera.quaternion.toArray()].every(Number.isFinite))host.__invalidCamera=true;
        return render.apply(this,args);
      };
    });
  });
  await page.goto('/home');
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-render-active','true');
  for(const action of ['computer','canvas'] as const) {
    await (await studioDestination(page, action)).click();
    await page.waitForTimeout(200);
    await expect(mount).toHaveAttribute('data-render-active','false');
    await page.goBack();await page.waitForTimeout(200);
    await expect(page).toHaveURL(/\/home$/);await expect(mount).toHaveAttribute('data-render-active','true');
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','room');
    expect(await page.evaluate(()=>(window as typeof window & {__invalidCamera?:boolean}).__invalidCamera??false)).toBe(false);
  }
});

test('normal-motion wheel input moves the camera on its first rendered frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const host = window as typeof window & { __THREE_DEVTOOLS__: EventTarget;
      __cameraInput?: { before:number; after?:number } };
    host.__THREE_DEVTOOLS__ = new EventTarget();
    host.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = (event as CustomEvent).detail;
      if (!renderer.isWebGLRenderer) return;
      const original = renderer.render;
      renderer.render = function (...args: unknown[]) {
        const result = original.apply(this, args);
        const input = host.__cameraInput;
        if (input && input.after === undefined) input.after = Number(document.querySelector<HTMLElement>('[data-studio-scene]')?.dataset.cameraZoom);
        return result;
      };
    });
    addEventListener('wheel', event => {
      if ((event.target as Element).closest('[data-studio-scene]')) host.__cameraInput = {
        before: Number(document.querySelector<HTMLElement>('[data-studio-scene]')?.dataset.cameraZoom),
      };
    }, { capture: true, passive: true });
  });
  await page.goto('/home');
  const mount = page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-render-active', 'true');
  const rect = (await mount.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * .12, rect.y + rect.height * .3);
  await page.mouse.wheel(0, -80);
  await expect.poll(() => page.evaluate(() => {
    const input = (window as typeof window & { __cameraInput?: { before:number; after?:number } }).__cameraInput;
    return input?.after !== undefined && input.after > input.before;
  })).toBe(true);
  await expect(page).toHaveURL(/\/home$/);
});
