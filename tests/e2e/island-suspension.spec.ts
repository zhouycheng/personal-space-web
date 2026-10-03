import { expect } from 'playwright/test';
import { test } from './helpers/nativePage';

test.skip(({browserName,isMobile})=>browserName!=='chromium'||isMobile,'Actual visibility requires native desktop Chromium');
test('ocean rendering sleeps in a real background tab and resumes on return',async({nativePage:page,baseURL})=>{
  await page.goto(`${baseURL}/home`);
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  const foreground=await page.context().newPage();
  await foreground.goto('about:blank');await foreground.bringToFront();
  await expect.poll(()=>page.evaluate(()=>document.hidden)).toBe(true);
  await expect(mount).toHaveAttribute('data-ocean-active','false');
  await expect(mount).toHaveAttribute('data-render-active','false');
  await page.waitForTimeout(500);
  await foreground.close();await page.bringToFront();
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  await expect(page.locator('[data-studio-scene] canvas')).toHaveCount(1);
});
