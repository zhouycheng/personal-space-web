import { expect } from "playwright/test";
import { test } from './helpers/app';
import { bookCanvas, manifest, phase, serveBook, visual } from "./helpers/journal";

test("T20 image and link regions use real page hits and modal Escape is isolated", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const book = await manifest(page);
  book.pages[0].regions = [{ kind: "image", href: book.pages[0].image, label: "测试插图", x: 0, y: 0, width: book.width, height: book.height }];
  book.pages[1].regions = [{ kind: "link", href: "/journal/does-not-exist", label: "测试链接", x: 0, y: 0, width: book.width, height: book.height }];
  await serveBook(page, book);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`);
  await phase(page, "reading");
  await page.keyboard.press("Home");
  const rect = (await bookCanvas(page).boundingBox())!;
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const dialog = page.locator("[data-journal-image]");
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await visual(page, info, "page-image-modal");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden(); await phase(page, "reading");
  await page.keyboard.press("ArrowRight");
  await expect(bookCanvas(page)).toHaveAttribute("data-journal-page", "1");
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page).toHaveURL(/\/journal\/does-not-exist$/);
  await expect(page.locator("[data-journal-status]")).toContainText("不存在");
});
