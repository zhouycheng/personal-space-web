import { expect } from "playwright/test";
import { test } from './helpers/app';
import { bookCanvas, drag, longBook, manifest, phase, serveBook, visual } from "./helpers/journal";

test("T23–T26 article URLs, refresh, legacy redirects and invalid slugs", async ({ page }, info) => {
  const book = await manifest(page), slug = encodeURIComponent(book.articles[0].slug);
  await page.goto(`/journal/${slug}`); await phase(page, "reading");
  await expect(page.locator("[data-journal-text], [data-journal-prose], [data-journal-mode]")).toHaveCount(0);
  await expect(page).toHaveTitle(new RegExp(book.articles[0].title));
  await visual(page, info, "article-reading");
  await page.reload(); await phase(page, "reading");
  expect((await page.request.get(`/blog/${slug}`, { maxRedirects: 0 })).status()).toBe(301);
  expect((await page.request.get("/journal/does-not-exist")).status()).toBe(404);
  await page.evaluate(() => { history.pushState({}, "", "/journal/does-not-exist"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.locator("[data-journal-status]")).toContainText(/不存在/);
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
});

test("T18–T22 odd final face, reading angles, zoom, responsive layout and keyboard", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const book = await longBook(page, 7);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, "reading");
  const history = await page.evaluate(() => window.history.length);
  await page.keyboard.press("Home");
  const canvas = bookCanvas(page), rect = (await canvas.boundingBox())!;
  await drag(page, rect.width / 2, rect.height / 2, 50, 30);
  expect(Math.abs(Number(await canvas.getAttribute("data-journal-yaw")))).toBeLessThanOrEqual(25 * Math.PI / 180);
  await page.keyboard.press("Home");
  await page.keyboard.press("+");
  await expect(canvas).toHaveAttribute("data-journal-zoom", "1.25");
  await drag(page, rect.width / 2, rect.height / 2, 40, 15);
  await expect(canvas).not.toHaveAttribute("data-journal-pan", "0,0");
  await page.keyboard.press("Home");
  await expect(canvas).toHaveAttribute("data-journal-pan", "0,0");
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("ArrowRight"); await phase(page, "reading");
    await expect(canvas).toHaveAttribute("data-journal-busy", "false");
  }
  await expect(canvas).toHaveAttribute("data-journal-page", "6");
  await page.keyboard.press("ArrowRight");
  await expect(canvas).toHaveAttribute("data-journal-page", "6");
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await visual(page, info, "odd-final-page");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-journal-progress]")).toHaveText("7 / 7");
  await page.keyboard.press("ArrowLeft"); await phase(page, "reading");
  await expect(canvas).toHaveAttribute("data-journal-page", "5");
  await page.keyboard.press("Escape"); await phase(page, "observing");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
  await expect(canvas).toHaveAttribute("data-journal-textures", "0");
});

test("T25 anchors and compatible bookmarks, rejected storage does not block reading", async ({ page }) => {
  const book = await manifest(page), article = book.articles[0], slug = encodeURIComponent(article.slug);
  await page.addInitScript(slug => {
    localStorage.setItem("justin-journal-bookmark", JSON.stringify({ slug, anchor: "removed", page: 999 }));
    Storage.prototype.setItem = () => { throw new DOMException("denied", "QuotaExceededError"); };
  }, article.slug);
  await page.goto(`/journal/${slug}#removed-anchor`); await phase(page, "reading");
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-page", String(article.start));
  await page.keyboard.press("Escape"); await phase(page, "observing");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
});

test("T25/T26 explicit anchors beat bookmarks and crossing articles replaces history", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const original = await manifest(page), article = original.articles[0];
  const book = { ...original,
    articles: [{ ...article, start: 0, count: 3 }, { ...article, slug: "fixture-second", start: 3, count: 3 }],
    pages: Array.from({ length: 6 }, (_, index) => ({ ...original.pages[index % original.pages.length],
      index, slug: index < 3 ? article.slug : "fixture-second", anchors: [`anchor-${index}`] })),
  };
  await serveBook(page, book);
  await page.addInitScript(slug => localStorage.setItem("justin-journal-bookmark", JSON.stringify({ slug, anchor: "anchor-2", page: 2 })), article.slug);
  await page.goto(`/journal/${encodeURIComponent(article.slug)}#anchor-1`);
  await phase(page, "reading");
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-page", "1");
  const history = await page.evaluate(() => window.history.length);
  for (const index of [2, 3]) {
    await page.keyboard.press("ArrowRight"); await phase(page, "reading");
    await expect(bookCanvas(page)).toHaveAttribute("data-journal-page", String(index));
  }
  await expect(page).toHaveURL(/\/journal\/fixture-second$/);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("justin-journal-bookmark")!))).toMatchObject({ slug: "fixture-second", page: 3 });
});

test("T30 failed textures keep an independent exit and recover on explicit retry", async ({ page }, info) => {
  const book = await manifest(page), slug = encodeURIComponent(book.articles[0].slug);
  let attempts = 0;
  await page.route("**/journal/generated/*/pages/*.webp*", route => { attempts++; return route.abort(); });
  await page.goto(`/journal/${slug}`);
  await expect(page.locator("[data-journal-retry]")).toBeVisible({ timeout: 35_000 });
  await expect(page.locator("[data-journal-status]")).toContainText("书页下载失败");
  await visual(page, info, "texture-error");
  expect(attempts).toBeLessThanOrEqual(book.pages.length * 2);
  await page.unroute("**/journal/generated/*/pages/*.webp*");
  await page.locator("[data-journal-retry]").click(); await phase(page, "reading");
  await visual(page, info, "retry-first-frame");
  await page.locator("[data-journal-close]").click(); await expect(page).toHaveURL(/\/home$/);
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-textures", "0");
});

test("T27 latest route wins when navigation interrupts journal preparation", async ({ page }) => {
  await page.goto("/home");
  await page.locator("[data-studio-explore]").focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-studio-action="diary"]').click();
  await expect(page).toHaveURL(/\/journal$/);
  await page.evaluate(() => { history.pushState({}, "", "/canvas"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "canvas");
  await page.waitForTimeout(1800);
  await expect(page).toHaveURL(/\/canvas$/);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-textures", "0");
});

test("T41 long book respects texture budgets and releases its working set", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const book = await longBook(page);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, "reading");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("ArrowRight");
    await phase(page, "reading");
    await expect(bookCanvas(page)).toHaveAttribute("data-journal-busy", "false");
    expect(Number(await bookCanvas(page).getAttribute("data-journal-textures"))).toBeLessThanOrEqual(4);
    expect(Number(await bookCanvas(page).getAttribute("data-journal-texture-bytes"))).toBeLessThanOrEqual(64 * 1024 * 1024);
    expect(Number(await bookCanvas(page).getAttribute("data-journal-decode-bytes"))).toBeLessThanOrEqual(48 * 1024 * 1024);
  }
  await page.locator("[data-journal-close]").click(); await expect(page).toHaveURL(/\/home$/);
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-textures", "0");
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-texture-bytes", "0");
});
