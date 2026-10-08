import { expect } from 'playwright/test';
import { test, studioDestination, studioSettings } from './helpers/app';

test('edge navigation adapts at the breakpoint and keeps the compact panel within the viewport', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date(2026, 9, 8, 14));
  await page.goto('/home');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active', 'true', { timeout: 35000 });
  const trigger = page.locator('[data-studio-explore]'), panel = page.locator('.studio-panel');
  await expect(page.locator('.studio-explore,.studio-hint')).toHaveCount(0);
  for (const [width, height] of [[390,844],[640,700],[641,700],[844,390],[1440,900],[1100,360]]) {
    await page.setViewportSize({ width, height });
    await expect(trigger).toHaveAccessibleName(width <= 640 ? '探索' : '场景设置');
    await expect(page.locator('.studio-direct-links')).toBeVisible({ visible: width > 640 });
    await trigger.click();
    await expect(panel).toBeVisible();
    if (width <= 640) {
      await expect(panel.locator('.studio-destinations a')).toHaveText(['作品','画布','日记','OS'].map(name => new RegExp(name)));
      await page.locator('[data-studio-tab="view"]').click();
      await page.locator('[data-studio-tab="places"]').click();
    }
    const rect = (await panel.boundingBox())!;
    expect(rect.width).toBeLessThanOrEqual(width <= 640 ? 480 : 272);
    expect(rect.x).toBeGreaterThanOrEqual(width <= 640 ? 0 : 12);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
    await expect(page.locator('[data-studio-close]')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`panel-${width}-${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.screenshot({ path: info.outputPath(`home-${width}-${height}.png`) });
  }
  await trigger.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 641, height: 700 });
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('modal focus and outside dismissal isolate scene input; settings and navigation still work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/home');
  const mount = page.locator('[data-studio-scene]');
  await studioSettings(page);
  const panel = page.locator('.studio-panel'), trigger = page.locator('[data-studio-explore]');
  await panel.locator('#studio-panel-title').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-studio-close]')).toBeFocused();
  const angle = await mount.getAttribute('data-camera-angle');
  await page.mouse.move(30, 200); await page.mouse.down();
  await page.mouse.move(100, 260, { steps: 8 }); await page.mouse.up();
  await expect(mount).toHaveAttribute('data-camera-angle', angle!);
  await page.mouse.click(30, 200);
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/home$/);
  await expect(trigger).toBeFocused();
  await studioSettings(page);
  await page.locator('[data-studio-tab="objects"]').click();
  const lamp = page.locator('[data-studio-action="lamp"]');
  await lamp.click(); await expect(lamp).toHaveAttribute('aria-checked', 'false');
  await page.locator('[data-studio-close]').click();
  await (await studioDestination(page, 'works')).click();
  await expect(page.locator('.studio-navigation')).toBeHidden();
  await page.locator('[data-gallery-return]').click();
  await expect(trigger).toBeVisible();
  await studioSettings(page);
  await page.locator('[data-studio-tab="objects"]').click();
  await expect(lamp).toHaveAttribute('aria-checked', 'false');
});
