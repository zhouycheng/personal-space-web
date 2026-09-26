import { expect } from "playwright/test";
import { test } from "./helpers/nativePage";
import { bookCanvas, phase } from "./helpers/journal";

test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Native desktop Chromium lifecycle probe; mobile and other engines use the shared functional suite");

test("T33 real background tab pauses for 60 seconds and resumes the same book", async ({ nativePage: page, baseURL }) => {
  test.setTimeout(120_000);
  const book = await (await page.request.get(`${baseURL}/journal/generated/manifest.json`)).json();
  await page.goto(`${baseURL}/journal/${encodeURIComponent(book.articles[0].slug)}`);
  await phase(page, "reading");
  const foreground = await page.context().newPage();
  await foreground.goto("about:blank");
  await foreground.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
  await expect(page.locator("[data-studio-scene]")).toHaveAttribute("data-render-active", "false");
  await page.waitForTimeout(60_000);
  await foreground.close();
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
  await phase(page, "reading");
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-page", "0");
  await page.keyboard.press("Escape");
  await phase(page, "observing");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
});

test("T33 actual BFCache pageshow restores the reading session", async ({ nativePage: page, baseURL }) => {
  await page.addInitScript(() => {
    window.addEventListener("pageshow", event => { document.documentElement.dataset.restoredFromCache = String(event.persisted); });
  });
  const book = await (await page.request.get(`${baseURL}/journal/generated/manifest.json`)).json();
  await page.goto(`${baseURL}/journal/${encodeURIComponent(book.articles[0].slug)}`);
  await phase(page, "reading");
  await page.goto(`${baseURL}/rss.xml`);
  await page.goBack({ waitUntil: "commit" });
  await expect(page.locator("html")).toHaveAttribute("data-restored-from-cache", "true");
  await phase(page, "reading");
  await expect(page.locator("[data-studio-scene] canvas")).toHaveCount(1);
  await page.keyboard.press("Escape"); await phase(page, "observing");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
});
