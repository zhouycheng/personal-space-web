import { expect } from "playwright/test";
import { test } from './helpers/app';

for (const [path, state] of [
  ["/", "room"],
  ["/home", "room"],
  ["/works", "room"],
  ["/canvas", "canvas"],
  ["/os", "desktop"],
  ["/journal", "journal"],
] as const) {
  test(`${path} remains stable after a direct load and refresh`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", state);
    await page.reload();
    await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", state);
  });
}
