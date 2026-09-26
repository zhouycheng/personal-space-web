import { expect, test } from "playwright/test";

test("file selection centers before opening, preserves copyable details and supports keyboard", async ({ page, isMobile }) => {
  await page.goto("/works");
  const buttons = page.locator("[data-gallery-file]"), dialog = page.locator("[data-gallery-detail]");
  expect(await page.locator("[data-studio-gallery]").evaluate(element => getComputedStyle(element).userSelect)).toBe("none");
  expect(await dialog.evaluate(element => getComputedStyle(element).userSelect)).toBe("text");
  const activate = async (index: number) => {
    const point = await buttons.nth(index).evaluate(button => {
      const rect = button.getBoundingClientRect();
      // WebKit rounds native pointer coordinates to integers. Stay inside the
      // rotated button instead of selecting its subpixel boundary.
      for (let y = Math.ceil(Math.max(0, rect.top)) + 8; y < Math.min(innerHeight, rect.bottom); y += 8) {
        for (let x = Math.ceil(Math.max(0, rect.left)) + 8; x < Math.min(innerWidth, rect.right); x += 8) {
          if ([[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dy]) =>
            button.contains(document.elementFromPoint(x + dx, y + dy)))) return { x, y };
        }
      }
      throw new Error("Card has no unobstructed hit target");
    });
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };
  await activate(1);
  await expect(page.locator('.gallery-item').nth(1)).toHaveAttribute("data-file-position", "current");
  await expect(dialog).not.toBeVisible();
  if (isMobile) await buttons.nth(1).tap(); else await buttons.nth(1).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("QandA");
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  await buttons.nth(2).focus();
  await expect(page.locator('.gallery-item').nth(2)).toHaveAttribute("data-file-position", "current");
  await page.keyboard.press("Enter"); await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
});
