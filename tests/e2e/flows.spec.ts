import { expect, test } from "playwright/test";

test("studio intent navigates through OS and browser history without a stale transition", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop pointer transition is covered here");
  await page.goto("/home");
  await page.locator("[data-studio-explore]").focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-studio-action="computer"]').click();
  await expect(page).toHaveURL(/\/os$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "room");
  await page.goForward();
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "desktop");
  await page.locator("[data-studio-return]").click();
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "room");
  await expect(page.locator("[data-studio-scene] canvas")).toHaveCount(1);
});

test("desktop icon opens a window and display settings remain usable", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop window pointer flow is covered here");
  await page.goto("/os");
  const icon = page.locator("[data-desktop-entry]").first();
  const id = await icon.getAttribute("data-desktop-entry");
  await icon.click();
  const window = page.locator(`[data-macos-window="${id}"]`);
  await expect(window).toBeVisible();
  const hint = page.locator("[data-os-home-hint]");
  if (await hint.isVisible()) await hint.locator("[data-os-hint-close]").click();
  await window.locator('[data-window-action="close"]').click();
  await expect(window).toHaveCount(0);
  await page.getByRole("button", { name: "显示控制" }).click();
  await expect(page.locator('[data-macos-window="__justin-os/display-controls"]')).toBeVisible();
  await expect(page.getByText("图标大小")).toBeVisible();
});

test("desktop icons respect the host safe area and restore a dragged position", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop drag is covered with a mouse here");
  await page.goto("/os");
  const icon = page.locator("[data-desktop-entry]").first();
  await expect(icon).toBeVisible();
  const id = await icon.getAttribute("data-desktop-entry");
  const before = await icon.boundingBox();
  const menu = await page.locator(".os-menu-bar").boundingBox();
  expect(before).not.toBeNull();
  expect(menu).not.toBeNull();
  expect(before!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height + 6);

  const x = before!.x + before!.width / 2;
  const y = before!.y + before!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y + 35, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate((entryId) => {
    const stored = JSON.parse(localStorage.getItem("justin-os-desktop-icon-layout") || "{}");
    return stored[entryId!]?.left;
  }, id)).toEqual(expect.any(Number));
  const moved = await icon.boundingBox();
  expect(Math.abs(moved!.x - before!.x)).toBeGreaterThan(25);
  await page.reload();
  await expect(icon).toBeVisible();
  const restored = await icon.boundingBox();
  expect(Math.abs(restored!.x - moved!.x)).toBeLessThan(2);
  expect(Math.abs(restored!.y - moved!.y)).toBeLessThan(2);
});

test("canvas saves only moved positions and resets to the published layout", async ({ page, isMobile }) => {
  test.skip(isMobile, "Touch browsing is covered separately");
  await page.goto("/canvas");
  const node = page.locator(".react-flow__node").first();
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 35);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 70, box!.y + 50, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("justin-canvas-positions-v1"))).not.toBeNull();
  await page.reload();
  await expect(node).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("justin-canvas-positions-v1"))).toBeTruthy();
  await page.getByRole("button", { name: "恢复默认布局" }).click();
  expect(await page.evaluate(() => localStorage.getItem("justin-canvas-positions-v1"))).toBeNull();
});

test("WebGL failure keeps keyboard content entry and journal HTML readable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return /webgl/.test(type) ? null : Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await page.goto("/home");
  await page.locator("[data-studio-explore]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".studio-panel")).toBeVisible();
  await page.locator('[data-studio-action="diary"]').focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.locator("[data-journal-text]")).toBeVisible();
  await expect(page.locator("[data-journal-prose]").first()).toContainText("生活节奏");
});

test("published article, RSS, and health respond from the built server", async ({ request }) => {
  const manifest = await (await request.get("/journal/generated/manifest.json")).json();
  const slug = encodeURIComponent(manifest.articles[0].slug);
  expect((await request.get(`/journal/${slug}`)).status()).toBe(200);
  expect((await request.get("/rss.xml")).status()).toBe(200);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).ok).toBe(true);
});
