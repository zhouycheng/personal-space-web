import { expect, type Page } from "playwright/test";
import { test } from './helpers/app';
import { phase, visual } from "./helpers/journal";

test("T19/T32 cover midpoint draws and Escape during opening exits", async ({ page }, info) => {
  await page.goto("/journal"); await phase(page, "observing");
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.locator("canvas[data-journal-phase]").focus(); await page.keyboard.press("Enter");
  await page.clock.runFor(375);
  await expect(page.locator("[data-journal-root]")).toHaveAttribute("data-phase", "opening");
  await visual(page, info, "cover-midpoint");
  await page.clock.runFor(600); await phase(page, "reading");
  await page.locator("[data-journal-fold]").click();
  await page.clock.runFor(375); await visual(page, info, "cover-closing-midpoint");
  await page.clock.runFor(600); await phase(page, "observing");
  await page.locator("canvas[data-journal-phase]").focus(); await page.keyboard.press("Enter");
  await page.clock.runFor(250);
  await page.keyboard.press("Escape");
  await page.clock.runFor(2400);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator("canvas[data-journal-textures]")).toHaveAttribute("data-journal-textures", "0");
});

test("journal controls stay minimal and fade while zoomed", async ({ page }, info) => {
  await page.goto("/journal"); await phase(page, "observing");
  const controls = page.locator(".journal-controls"), hint = page.locator(".journal-hint");
  await expect(controls).toBeHidden();
  await expect(hint).toContainText("点击封面打开");
  await visual(page, info, "book-closed-minimal-ui");
  await page.locator("canvas[data-journal-phase]").focus(); await page.keyboard.press("Enter");
  await phase(page, "reading");
  await expect(controls).toBeVisible();
  await expect(controls.locator("button:visible")).toHaveCount(1);
  await expect(controls.locator("button:visible")).toHaveText("合拢");
  await expect(controls.locator("output")).toContainText(/\d+(?:–\d+)? \/ \d+/);
  await expect(hint).toContainText("点击书页翻页");
  await expect.poll(async () => {
    const footer = await controls.boundingBox(), tip = await hint.boundingBox();
    return footer && tip ? Math.round(tip.y - (footer.y + footer.height)) : -1;
  }).toBeGreaterThan(0);
  await visual(page, info, "book-open-minimal-ui");
  await page.keyboard.press("+");
  await expect.poll(() => controls.evaluate(element => getComputedStyle(element).opacity)).toBe("0");
  await expect.poll(() => hint.evaluate(element => getComputedStyle(element).opacity)).toBe("0");
  await expect(controls).toHaveAttribute("inert", "");
  for (const selector of [".journal-controls", ".journal-hint", ".journal-close"]) {
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  }
  await visual(page, info, "book-zoom-no-overlay");
  await page.keyboard.press("0");
  await expect.poll(() => controls.evaluate(element => getComputedStyle(element).opacity)).toBe("1");
  await expect.poll(() => hint.evaluate(element => getComputedStyle(element).opacity)).toBe("1");
  await expect(controls).not.toHaveAttribute("inert", "");
});

type Frame = { t: number; ready: string; position: number[]; scale: number[] };
async function record(page: Page, action: () => Promise<void>, state: string) {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.evaluate(() => {
    const frames: Frame[] = [];
    Object.assign(window, { transportFrames: frames, recordTransport: true });
    const sample = () => {
      const mount = document.querySelector<HTMLElement>("[data-studio-scene]")!, canvas = mount.querySelector("canvas")!;
      frames.push({ t: Number(canvas.dataset.journalTravel), ready: mount.dataset.journalDrawerReady!, position: canvas.dataset.journalPosition?.split(",").map(Number) ?? [], scale: canvas.dataset.journalScale?.split(",").map(Number) ?? [] });
      if ((window as any).recordTransport) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await action(); await page.clock.runFor(2400);
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", state);
  const frames = await page.evaluate(() => { (window as any).recordTransport = false; return (window as any).transportFrames as Frame[]; });
  await page.clock.resume();
  const moving = frames.filter(frame => frame.t > 0 && frame.t < .55 && frame.position.length);
  expect(moving.length).toBeGreaterThan(0);
  for (const frame of moving) {
    expect(frame.ready).toBe("true");
    expect(frame.scale[0]).toBeCloseTo(.39, 6);
    expect(frame.scale[1]).toBeCloseTo(.47 / (594 / 420), 6);
    if (frame.t < .28) expect(frame.position[2]).toBeCloseTo(-.22, 2);
    else { expect(frame.position[1]).toBeGreaterThanOrEqual(1.65); expect(frame.position[2]).toBeGreaterThanOrEqual(-.221); }
  }
  expect(moving.some(frame => frame.position[1] > 1.65)).toBe(true);
}

test("T14/T19 transport clears the drawer before expanding in both directions", async ({ page }) => {
  await page.goto("/home");
  await expect(page.locator("[data-studio-scene]")).toHaveAttribute("data-render-active", "true");
  await page.clock.install();
  await page.locator("[data-studio-explore]").focus(); await page.keyboard.press("Enter");
  await record(page, () => page.locator('[data-studio-action="diary"]').click(), "journal");
  await record(page, () => page.locator("[data-journal-close]").click(), "room");
});

test("return carries the closed book at its current angle before easing it into the drawer", async ({ page }, info) => {
  await page.goto("/journal"); await phase(page, "observing");
  const canvas = page.locator("canvas[data-journal-phase]"), rect = (await canvas.boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 90, y + 30, { steps: 8 }); await page.mouse.up();
  const yaw = Number(await canvas.getAttribute("data-journal-yaw"));
  expect(Math.abs(yaw)).toBeGreaterThan(.2);
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.locator("[data-journal-close]").click();
  expect(Number(await canvas.getAttribute("data-journal-yaw"))).toBeCloseTo(yaw, 5);
  await page.clock.runFor(250);
  const travel = Number(await canvas.getAttribute("data-journal-travel"));
  expect(travel).toBeGreaterThan(0);
  expect(travel).toBeLessThan(1);
  await visual(page, info, "book-returning-at-current-angle");
  await page.clock.runFor(1000);
  await expect(page.locator("[data-studio]")).toHaveAttribute("data-state", "room");
});
