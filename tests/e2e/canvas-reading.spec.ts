import { expect } from "playwright/test";
import { test } from './helpers/app';

test("T36 narrow canvas contents focus a readable card without persisting viewport", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/canvas");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const storage = await page.evaluate(() => localStorage.getItem("justin-canvas-positions-v1"));
  const contents = page.getByRole("button", { name: "内容", exact: true });
  if (isMobile) await contents.tap(); else await contents.click();
  const sidebar = page.getByRole("complementary", { name: "画布内容" });
  await expect(sidebar).toBeVisible();
  const card = sidebar.locator("nav button").first();
  if (isMobile) await card.tap(); else await card.click();
  await expect(contents).toHaveAttribute("aria-expanded", "false");
  const image = page.locator(".canvas-card--businesscard img").first();
  await expect(image).toBeVisible();
  expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem("justin-canvas-positions-v1"))).toBe(storage);
  await contents.focus(); await page.keyboard.press("Enter");
  await sidebar.locator("nav button").first().focus(); await page.keyboard.press("Escape");
  await expect(contents).toBeFocused();
});
