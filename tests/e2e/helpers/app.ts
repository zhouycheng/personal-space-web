import { test as base } from 'playwright/test';
/** Existing scene/content regressions exercise a tab which already entered.
 * Fresh-session behavior is covered explicitly in entrance.spec.ts. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => sessionStorage.setItem('justin-entrance-completed','1'));
    await use(page);
  },
});
