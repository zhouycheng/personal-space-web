import { expect, test } from "playwright/test";
import { bookCanvas, manifest, phase, visual } from "./helpers/journal";

test("T29 context loss restores a rendered book and never leaves input locked", async ({ page }, info) => {
  const book = await manifest(page);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`);
  await phase(page, "reading");
  await bookCanvas(page).evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2")!;
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Environment blocker: WEBGL_lose_context unavailable");
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 500);
  });
  await expect(page.locator("[data-journal-status]")).toBeVisible();
  await phase(page, "reading");
  await expect(page.locator("[data-studio-scene] canvas")).toHaveCount(1);
  await visual(page, info, "context-restored");
  await page.keyboard.press("Escape"); await phase(page, "observing");
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
});

test("T30/T32 Escape cancels delayed preparation and late bytes cannot reopen the book", async ({ page }) => {
  const book = await manifest(page);
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/journal/generated/*/pages/*.webp*", async route => {
    await delayed;
    await route.continue().catch(() => {});
  });
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`);
  await expect(page.locator("[data-journal-root]")).toHaveAttribute("data-phase", /preparing|extracting/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/home$/);
  release();
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "room");
  await page.waitForTimeout(1000);
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-textures", "0");
  await expect(page).toHaveURL(/\/home$/);
});

for (const availability of ["empty", "missing", "outdated"]) {
  test(`T02–T04 ${availability} has a finite explicit state and an exit`, async ({ page }) => {
    await page.route("**/journal", async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /(<script[^>]*data-journal-manifest[^>]*>)([\s\S]*?)(<\/script>)/,
        (_, begin, data, end) => {
          const book = JSON.parse(data); book.availability = availability;
          if (availability === "empty") { book.pages = []; book.articles = []; }
          return begin + JSON.stringify(book).replace(/</g, "\\u003c") + end;
        },
      );
      await route.fulfill({ response, body });
    });
    await page.goto("/journal");
    await expect(page.locator("[data-journal-root]")).toHaveAttribute("data-availability", availability);
    await expect(page.locator("[data-journal-status]")).toBeVisible();
    await expect(page.locator("[data-journal-fold]")).toBeHidden();
    await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/home$/);
  });
}
