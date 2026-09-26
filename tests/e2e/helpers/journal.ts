import { expect, type Page, type TestInfo } from "playwright/test";

export const bookCanvas = (page: Page) => page.locator("canvas[data-journal-phase]");
export async function phase(page: Page, value: string) {
  await expect(page.locator("[data-journal-root]")).toHaveAttribute("data-phase", value, { timeout: 35_000 });
  if (value === "reading") {
    await expect(page.locator("[data-journal-root]")).toHaveAttribute("data-availability", "ready");
    await expect(bookCanvas(page)).toHaveAttribute("data-journal-drawn", "true");
    await expect(bookCanvas(page)).toHaveAttribute("data-journal-busy", "false");
  }
}
export async function visual(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}
export async function manifest(page: Page) {
  const response = await page.request.get("/journal/generated/manifest.json");
  expect(response.ok()).toBe(true);
  return response.json();
}
/** Isolated browser fixture; repository journal and published pages stay untouched. */
export async function longBook(page: Page, count = 61) {
  const original = await manifest(page);
  const book = { ...original,
    pages: Array.from({ length: count }, (_, index) => ({ ...original.pages[index % original.pages.length], index,
      image: `${original.pages[index % original.pages.length].image}?test-page=${index}`,
      anchors: [`fixture-${index}`],
    })),
    articles: [{ ...original.articles[0], start: 0, count }],
  };
  await serveBook(page, book);
  return book;
}

export async function serveBook(page: Page, book: unknown) {
  await page.route(/\/journal(?:\/[^?]*)?$/, async route => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /(<script[^>]*data-journal-manifest[^>]*>)[\s\S]*?(<\/script>)/,
      (_, begin, end) => begin + JSON.stringify(book).replace(/</g, "\\u003c") + end,
    );
    await route.fulfill({ response, body });
  });
}

export async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
}
