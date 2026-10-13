import { expect } from 'playwright/test';
import { test } from './helpers/nativePage';

test.skip(({browserName,isMobile})=>browserName!=='chromium'||isMobile,'Actual visibility requires native desktop Chromium');
test('ocean and campfire sleep in a real background tab and resume on return',async({nativePage:page,baseURL})=>{
  await page.goto(`${baseURL}/home`);
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  await page.locator('[data-studio-explore]').click();
  await page.getByRole('tab',{name:'音乐',exact:true}).click();
  const audio=page.locator('[data-ocean-audio]');
  await expect(audio).toHaveAttribute('data-state','playing');
  await page.keyboard.press('Escape');
  const foreground=await page.context().newPage();
  await foreground.goto('about:blank');await foreground.bringToFront();
  await expect.poll(()=>page.evaluate(()=>document.hidden)).toBe(true);
  await expect(mount).toHaveAttribute('data-ocean-active','false');
  await expect(mount).toHaveAttribute('data-render-active','false');
  await expect(audio).toHaveAttribute('data-state','paused');
  const pausedFuel=await mount.getAttribute('data-campfire-logs');
  await page.waitForTimeout(500);
  expect(await mount.getAttribute('data-campfire-logs')).toBe(pausedFuel);
  await foreground.close();await page.bringToFront();
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  await expect(audio).toHaveAttribute('data-state','playing');
  await expect.poll(()=>mount.getAttribute('data-campfire-logs')).not.toBe(pausedFuel);
  await expect(page.locator('[data-studio-scene] canvas')).toHaveCount(1);
});
