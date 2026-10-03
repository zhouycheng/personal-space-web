import { expect, test } from "playwright/test";
import { phase } from "./helpers/journal";

test('ocean animates only in the visible home and respects reduced motion', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date(2026, 9, 3, 14));
  const errors: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/home');
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  const a=await page.screenshot();
  await page.waitForTimeout(300);
  const b=await page.screenshot({path:info.outputPath('island-day.png')});
  expect(a.equals(b)).toBe(false);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(mount).toHaveAttribute('data-ocean-active','false');
  await expect(mount).toHaveAttribute('data-steam-active','false');
  await page.waitForTimeout(200);
  const still=await page.screenshot();
  await page.waitForTimeout(250);
  expect(still.equals(await page.screenshot())).toBe(true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  for(const [action,state] of [['computer','desktop'],['canvas','canvas'],['works','room'],['diary','journal']]) {
    await page.locator('[data-studio-explore]').focus();await page.keyboard.press('Enter');
    await page.locator(`[data-studio-action="${action}"]`).click();
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state',state);
    await expect(mount).toHaveAttribute('data-ocean-active','false');
    if(action==='diary') {
      await phase(page,'observing');
      await page.locator('canvas[data-journal-phase]').focus();await page.keyboard.press('Enter');
      await phase(page,'reading');
      await expect(mount).toHaveAttribute('data-ocean-active','false');
    }
    await page.goBack();
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','room');
    await expect(mount).toHaveAttribute('data-ocean-active','true');
  }
  expect(errors).toEqual([]);
});

test('sea background dragging cannot activate furniture; zoom and reset preserve the island overview', async ({page},info)=>{
  await page.clock.setFixedTime(new Date(2026,9,3,14));
  await page.goto('/home');
  const mount=page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-ocean-active','true');
  const rect=(await mount.boundingBox())!;
  const x=rect.x+rect.width*.12,y=rect.y+rect.height*.3;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+60,y+25,{steps:10});await page.mouse.up();
  await expect(mount).not.toHaveAttribute('data-camera-angle','-0.4800');
  await expect(page).toHaveURL(/\/home$/);
  await page.mouse.wheel(0,-500);
  await expect.poll(async()=>Number(await mount.getAttribute('data-camera-zoom'))).toBeGreaterThan(1.1);
  await page.waitForTimeout(400);
  await page.screenshot({path:info.outputPath('island-close.png')});
  await page.locator('[data-studio-explore]').focus();await page.keyboard.press('Enter');
  await page.locator('[data-studio-tab="view"]').click();
  await page.locator('[data-studio-action="reset-view"]').click();
  await page.locator('[data-studio-close]').click();
  await expect(mount).toHaveAttribute('data-camera-zoom','1.0000');
  await expect(mount).toHaveAttribute('data-camera-angle','-0.4800');
});
