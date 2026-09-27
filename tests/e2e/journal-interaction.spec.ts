import { expect, test, type Page } from "playwright/test";
import { bookCanvas, longBook, phase, visual } from "./helpers/journal";

async function drawerPanel(page: Page) {
  await page.locator('[data-studio-explore]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-studio-tab="objects"]').click();
  const details = page.locator('.studio-drawers');
  if (!(await details.evaluate(element => (element as HTMLDetailsElement).open))) await details.locator('summary').click();
}

test('T13–T17 actual drawer book and cover hits complete the reading and return path', async ({ page }, info) => {
  await page.goto('/home');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active', 'true');
  await drawerPanel(page);
  await page.locator('[data-studio-action="drawer-top"]').click();
  await page.locator('[data-studio-close]').click();
  const mount = page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-diary-target', /,/);
  // Wait for the physical drawer to settle before taking its book's projection.
  await page.waitForTimeout(500);
  const target = (await mount.getAttribute('data-diary-target'))!.split(',').map(Number);
  const bounds = (await mount.boundingBox())!;
  await visual(page, info, 'drawer-open');
  const point = { x: bounds.x + target[0], y: bounds.y + target[1] };
  await page.mouse.move(point.x, point.y);
  // The press/release are native. Controlled same-task moves exercise a path
  // that can be coalesced to its origin before a renderer frame sees it.
  await mount.locator('canvas').evaluate(canvas => {
    canvas.addEventListener('pointerdown', event => { canvas.dataset.testPointer = String((event as PointerEvent).pointerId); }, { once: true });
  });
  await page.mouse.down();
  await mount.locator('canvas').evaluate((canvas, point) => {
    const pointerId = Number(canvas.dataset.testPointer);
    for (const x of [point.x + 20, point.x]) canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: point.y, pointerId, pointerType: 'mouse', buttons: 1, bubbles: true,
    }));
    delete canvas.dataset.testPointer;
  }, point);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/home$/);
  await page.mouse.click(bounds.x + target[0], bounds.y + target[1]);
  await expect(page).toHaveURL(/\/journal$/);
  await phase(page, 'observing');
  await expect(page.locator('[data-journal-fold]')).toBeHidden();
  await visual(page, info, 'book-observing');
  const canvas = bookCanvas(page), rect = (await canvas.boundingBox())!;
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await phase(page, 'reading');
  await visual(page, info, 'cover-opened-by-hit');
  await page.keyboard.press('Escape'); await phase(page, 'observing');
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'room');
  await expect(canvas).toHaveAttribute('data-journal-textures', '0');
  await drawerPanel(page);
  await expect(page.locator('[data-studio-action="drawer-top"]')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-studio-action="drawer-top"]').click();
  await page.locator('[data-studio-close]').click();
  await page.waitForTimeout(500);
  await page.mouse.click(bounds.x + target[0], bounds.y + target[1]);
  await expect(page).toHaveURL(/\/home$/);
});

test('T44 shell removal releases its renderer and reinsertion creates a single working instance', async ({ page }) => {
  await page.goto('/home');
  const mount = page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-render-active', 'true');
  const released = await page.evaluate(async () => {
    const shell = document.querySelector<HTMLElement>('.alpha-shell')!;
    const canvas = shell.querySelector<HTMLCanvasElement>('[data-studio-scene] canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const parent = shell.parentElement!, next = shell.nextSibling;
    shell.remove();
    await new Promise(resolve => setTimeout(resolve, 100));
    const released = gl.isContextLost() && !canvas.isConnected;
    parent.insertBefore(shell, next);
    return released;
  });
  expect(released).toBe(true);
  await expect(mount.locator('canvas')).toHaveCount(1);
  await expect(mount).toHaveAttribute('data-render-active', 'true');
  await drawerPanel(page);
  const lamp = page.locator('[data-studio-action="lamp"]');
  await expect(lamp).toHaveAttribute('aria-checked', 'true');
  await lamp.click(); await expect(lamp).toHaveAttribute('aria-checked', 'false');
});

type PageTarget = { page: number; left: boolean; center: { x: number; y: number }; edge: { x: number; y: number } };
async function rightPage(page: Page) {
  const targets = JSON.parse((await bookCanvas(page).getAttribute('data-journal-page-targets'))!) as PageTarget[];
  return targets.find(target => !target.left)!;
}

test('T19/T17 a partly turned sheet renders both faces and a blur event rolls it back', async ({ page }, info) => {
  const book = await longBook(page, 7);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, 'reading');
  await page.keyboard.press('Home');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-drawn', 'true');
  let target = await rightPage(page);
  const single = (JSON.parse((await bookCanvas(page).getAttribute('data-journal-page-targets'))!) as PageTarget[]).length === 1;
  const distance = Math.max(150, (await bookCanvas(page).boundingBox())!.width * (single ? .65 : .3)) * .6;
  await page.mouse.move(target.edge.x, target.edge.y); await page.mouse.down();
  await page.mouse.move(target.edge.x - 2, target.edge.y);
  await visual(page, info, 'turn-near-contact');
  await page.mouse.move(target.edge.x - distance, target.edge.y, { steps: 10 });
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-busy', 'true');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-page', '0');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-drawn', 'true');
  await visual(page, info, 'turn-intermediate');
  // Headless tab activation does not reliably change native window focus. The
  // drag is real mouse input; dispatch blur explicitly to verify its cleanup.
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
  await page.mouse.up();
  await phase(page, 'reading');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-page', '0');
  target = await rightPage(page);
  await page.mouse.move(target.edge.x, target.edge.y); await page.mouse.down();
  await page.mouse.move(target.edge.x - distance, target.edge.y, { steps: 10 }); await page.mouse.up();
  await phase(page, 'reading');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-page', single ? '1' : '2');
  await visual(page, info, 'turn-committed');
});

test('T17/T21 real touch cancellation rolls back a turn and a two-finger pinch changes zoom', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Touch cancellation requires Chromium protocol; other engines need their own device input validation.');
  const book = await longBook(page, 7);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, 'reading');
  await page.keyboard.press('Home');
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-drawn', 'true');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const target = await rightPage(page), point = (id: number, x: number, y: number) => ({ id, x, y, radiusX: 3, radiusY: 3, force: 1 });
  const distance = Math.min(150, target.edge.x - 10);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, target.edge.x, target.edge.y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, target.edge.x - distance, target.edge.y)] });
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-busy', 'true');
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await phase(page, 'reading'); await expect(bookCanvas(page)).toHaveAttribute('data-journal-page', '0');
  const { x, y } = (await rightPage(page)).center;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, x - 25, y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, x - 25, y), point(2, x + 25, y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, x - 45, y), point(2, x + 45, y)] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await bookCanvas(page).getAttribute('data-journal-zoom'))).toBeGreaterThan(1.3);
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-page', '0');
  await visual(page, info, 'two-finger-zoom');
  await session.detach();
});

test('single-page folded notebook wraps forward and back and preserves the page on resize', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const book = await longBook(page, 4);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, 'reading');
  const canvas = bookCanvas(page);
  await expect(canvas).toHaveAttribute('data-journal-fold-amount', '1');
  await expect(canvas).toHaveAttribute('data-journal-sheets', '0,2');
  await visual(page, info, 'folded-reading');
  const center = (await rightPage(page)).center;
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(center.x + 60, center.y + 20, { steps: 8 }); await page.mouse.up();
  await visual(page, info, 'folded-side');
  await page.keyboard.press('Home');
  await expect(canvas).toHaveAttribute('data-journal-drawn', 'true');
  let target = await rightPage(page);
  const distance = Math.max(150, (await canvas.boundingBox())!.width * .82);
  await page.mouse.move(target.edge.x, target.edge.y); await page.mouse.down();
  for (const progress of [.05, .25, .5, .75, .95]) {
    await page.mouse.move(target.edge.x - distance * progress, target.edge.y, { steps: 3 });
    await expect(canvas).toHaveAttribute('data-journal-busy', 'true');
    await visual(page, info, `folded-forward-${progress}`);
  }
  await page.mouse.up(); await phase(page, 'reading');
  await expect(canvas).toHaveAttribute('data-journal-page', '1');
  target = await rightPage(page);
  const leftEdge = target.center.x * 2 - target.edge.x;
  await page.mouse.move(leftEdge, target.edge.y); await page.mouse.down();
  for (const progress of [.05, .25, .5, .75, .95]) {
    await page.mouse.move(leftEdge + distance * progress, target.edge.y, { steps: 3 });
    await visual(page, info, `folded-backward-${progress}`);
  }
  await page.mouse.up(); await phase(page, 'reading');
  await expect(canvas).toHaveAttribute('data-journal-page', '0');
  target = await rightPage(page);
  const bottom = target.center.y * 2 - target.edge.y;
  await page.mouse.move(target.edge.x, bottom); await page.mouse.down();
  await page.mouse.move(target.edge.x-distance*.2,bottom,{steps:8});
  await expect(canvas).toHaveAttribute('data-journal-busy','true');
  await visual(page,info,'folded-bottom-cancel');
  await page.mouse.move(target.edge.x,bottom,{steps:8});await page.mouse.up();
  await phase(page,'reading');await expect(canvas).toHaveAttribute('data-journal-page','0');
  await page.keyboard.press('ArrowRight'); await phase(page, 'reading');
  await expect(canvas).toHaveAttribute('data-journal-page', '1');
  target = await rightPage(page);
  await page.mouse.move(target.edge.x, target.edge.y); await page.mouse.down();
  await page.mouse.move(target.edge.x - distance * .3, target.edge.y, { steps: 5 });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-journal-fold-amount', '0');
  await expect(canvas).toHaveAttribute('data-journal-page', '1');
  await expect(canvas).toHaveAttribute('data-journal-busy', 'false');
  await visual(page, info, 'unfolded-after-resize');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute('data-journal-fold-amount', '1');
  await expect(canvas).toHaveAttribute('data-journal-page', '1');
  await page.keyboard.press('Escape'); await phase(page, 'observing');
  await visual(page, info, 'folded-closed');
  await canvas.focus(); await page.keyboard.press('Enter'); await phase(page, 'reading');
  await expect(canvas).toHaveAttribute('data-journal-fold-amount', '1');
  await page.keyboard.press('ArrowRight'); await phase(page, 'reading');
  await expect(canvas).toHaveAttribute('data-journal-page', '2');
  await expect(canvas).toHaveAttribute('data-journal-sheets', '1,1');
  const finalCenter=(await rightPage(page)).center;
  await page.mouse.move(finalCenter.x,finalCenter.y);await page.mouse.down();
  await page.mouse.move(finalCenter.x+60,finalCenter.y+20,{steps:8});await page.mouse.up();
  await visual(page,info,'folded-one-sheet-behind');
});

test('T44 a failed GPU texture deletion does not strand bitmaps or block journal exit', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { armed: false, injected: false, closed: 0 };
    Object.assign(window, { __journalDisposal: state });
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () { state.closed++; return Reflect.apply(close, this, []); };
    const remove = WebGL2RenderingContext.prototype.deleteTexture;
    WebGL2RenderingContext.prototype.deleteTexture = function (...args) {
      if (state.armed && !state.injected) { state.injected = true; throw new Error('Injected texture disposal failure'); }
      return Reflect.apply(remove, this, args);
    };
  });
  const book = await longBook(page, 2);
  await page.goto(`/journal/${encodeURIComponent(book.articles[0].slug)}`); await phase(page, 'reading');
  const textures = Number(await bookCanvas(page).getAttribute('data-journal-textures'));
  const closedBefore = await page.evaluate(() => {
    const state = (window as unknown as { __journalDisposal: { armed: boolean; closed: number } }).__journalDisposal;
    state.armed = true; return state.closed;
  });
  await page.locator('[data-journal-close]').click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(bookCanvas(page)).toHaveAttribute('data-journal-textures', '0');
  const disposal = await page.evaluate(() => (window as unknown as { __journalDisposal: { injected: boolean; closed: number } }).__journalDisposal);
  expect(disposal.injected).toBe(true);
  expect(disposal.closed - closedBefore).toBeGreaterThanOrEqual(textures);
});
