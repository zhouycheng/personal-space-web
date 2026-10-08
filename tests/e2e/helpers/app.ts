import { test as base, expect, type Page } from 'playwright/test';
import type { StudioAction } from '../../../src/contracts/studio';

export async function studioDestination(page: Page, action: StudioAction) {
  await expect(page.locator('.studio-navigation')).toBeVisible({ timeout: 35000 });
  const panel = page.locator('.studio-panel');
  if (await panel.isVisible()) return panel.locator(`[data-studio-action="${action}"]`);
  const direct = page.locator(`.studio-direct-links [data-studio-action="${action}"]`);
  if (await direct.isVisible()) return direct;
  await page.locator('[data-studio-explore]').click();
  return panel.locator(`[data-studio-action="${action}"]`);
}

export async function studioSettings(page: Page) {
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active', 'true', { timeout: 35000 });
  await page.locator('[data-studio-explore]').click();
  await page.locator('[data-studio-tab="view"]').click();
}
/** Existing scene/content regressions exercise a tab which already entered.
 * Fresh-session behavior is covered explicitly in entrance.spec.ts. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => sessionStorage.setItem('justin-entrance-completed','1'));
    await use(page);
  },
});
