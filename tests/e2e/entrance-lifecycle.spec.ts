import { expect } from 'playwright/test';
import { test } from './helpers/nativePage';
test.use({freshEntrance:true});

test('real backgrounding pauses entrance progress; BFCache resumes a completed tab without replay',async({nativePage:page,baseURL})=>{
  const overlay=page.locator('[data-cloud-entrance]'),mount=page.locator('[data-studio-scene]');
  await expect(overlay).toHaveAttribute('data-state','ready',{timeout:35000});
  await page.keyboard.press('Enter');
  await expect.poll(async()=>Number(await mount.getAttribute('data-entrance-progress'))).toBeGreaterThan(.1);
  const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();
  await expect.poll(()=>page.evaluate(()=>document.hidden)).toBe(true);
  const progress=await mount.getAttribute('data-entrance-progress');await page.waitForTimeout(1200);
  expect(await mount.getAttribute('data-entrance-progress')).toBe(progress);
  await expect(mount).toHaveAttribute('data-render-active','false');
  await page.bringToFront();await expect.poll(()=>page.evaluate(()=>document.hidden)).toBe(false);
  await expect(overlay).toBeHidden({timeout:15000});await other.close();
  await page.evaluate(()=>{window.addEventListener('pageshow',event=>document.documentElement.dataset.persisted=String(event.persisted));});
  await page.goto(`${baseURL}/rss.xml`);await page.goBack({waitUntil:'commit'});
  await expect(overlay).toBeHidden();await expect(mount).toHaveAttribute('data-render-active','true');
  await expect(page.locator('html')).toHaveAttribute('data-persisted','true');
});

test('context loss while waiting never records success and retry returns to a prepared entrance',async({nativePage:page})=>{
  const overlay=page.locator('[data-cloud-entrance]');
  await expect(overlay).toHaveAttribute('data-state','ready',{timeout:35000});
  await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-studio-scene] canvas')!;
    const extension=canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    extension.loseContext();setTimeout(()=>extension.restoreContext(),300);
  });
  await expect(overlay).toHaveAttribute('data-state','error');
  expect(await page.evaluate(()=>sessionStorage.getItem('justin-entrance-completed'))).toBeNull();
  await page.locator('[data-cloud-retry]').click();
  await expect(overlay).toHaveAttribute('data-state','ready',{timeout:35000});
  await page.keyboard.press('Enter');await expect(overlay).toBeHidden({timeout:15000});
});
