import { expect, type Page } from 'playwright/test';
import { test, studioDestination } from './helpers/app';

test.use({ reducedMotion: 'reduce' });

async function openDesktop(page: Page) {
  await page.goto('/os');
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'desktop');
  const hint = page.locator('[data-os-home-hint]');
  if (await hint.isVisible()) await hint.locator('[data-os-hint-close]').click();
}

async function openMarkdown(page: Page) {
  await page.getByRole('button', { name: '打开 人生系统', exact: true }).click();
  return page.locator('[data-macos-window="人生系统.md"]');
}

test('canvas stops its activity subscription immediately and restores memory-only viewport after idle unload', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeSource = window.EventSource;
    const stats = { opened: 0, closed: 0 };
    Object.assign(window, { lifecycleStreams: stats });
    window.EventSource = class extends NativeSource {
      closedByClient = false;
      constructor(url: string | URL, init?: EventSourceInit) { super(url, init); stats.opened++; }
      close() {
        if (!this.closedByClient) { stats.closed++; this.closedByClient = true; }
        super.close();
      }
    };
  });
  await page.goto('/canvas');
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).lifecycleStreams.opened)).toBe(1);
  const initialZoom = await page.locator('.canvas-view-controls output').textContent();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(page.locator('.canvas-view-controls output')).not.toHaveText(initialZoom!);
  const zoom = await page.locator('.canvas-view-controls output').textContent();
  const transform = await page.locator('.react-flow__viewport').evaluate(el => (el as HTMLElement).style.transform);
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /canvas|viewport/i.test(key))));
  await page.clock.install();
  await page.locator('[data-canvas-return]').click();
  await expect(page).toHaveURL(/\/home$/);
  const homeStreams = page.viewportSize()!.width > 640 ? 1 : 0;
  const liveStreams = () => page.evaluate(() => {
    const { opened, closed } = (window as any).lifecycleStreams;
    return opened - closed;
  });
  // The desktop profile can retain the same shared stream after canvas releases it.
  await expect.poll(liveStreams).toBe(homeStreams);
  await expect(page.locator('.react-flow')).toHaveCount(1);
  await page.clock.fastForward(60_100);
  await expect(page.locator('.react-flow')).toHaveCount(0);
  await expect.poll(liveStreams).toBe(homeStreams);
  await (await studioDestination(page, 'canvas')).click();
  await page.clock.runFor(100);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect.poll(liveStreams).toBe(1);
  await expect(page.locator('.canvas-view-controls output')).toHaveText(zoom!);
  await expect.poll(() => page.locator('.react-flow__viewport').evaluate(el => (el as HTMLElement).style.transform)).toBe(transform);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /canvas|viewport/i.test(key))))).toEqual(storage);
  await page.locator('[data-canvas-return]').click();
  await (await studioDestination(page, 'computer')).click();
  await expect.poll(liveStreams).toBe(0);
});

test('closing a Markdown window aborts the slow request and its late failure cannot change detached content', async ({ page }) => {
  let release: (() => void) | undefined;
  let aborted = 0;
  page.on('close', () => release?.());
  page.on('requestfailed', request => { if (decodeURIComponent(request.url()).endsWith('/人生系统.md')) aborted++; });
  await page.route('**/os-desktop/**', async route => {
    if (!decodeURIComponent(route.request().url()).endsWith('/人生系统.md')) return route.continue();
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ status: 503, body: 'Delayed failure' }).catch(() => {});
  });
  await openDesktop(page);
  const desktopWindow = await openMarkdown(page);
  await expect(desktopWindow.locator('.macos-window-loading')).toHaveText('Loading...');
  await page.evaluate(() => Object.assign(globalThis, { closedContent: document.querySelector('[data-macos-window="人生系统.md"] .macos-window-body') }));
  await desktopWindow.locator('[data-window-action="close"]').click();
  await expect(desktopWindow).toHaveCount(0);
  await expect.poll(() => aborted).toBe(1);
  release?.();
  await expect.poll(() => page.evaluate(() => (window as any).closedContent.textContent)).toBe('');
});

test('minimizing Markdown aborts loading and restoring starts one fresh request', async ({ page }) => {
  let attempts = 0;
  let release: (() => void) | undefined;
  page.on('close', () => release?.());
  await page.route('**/os-desktop/**', async route => {
    if (!decodeURIComponent(route.request().url()).endsWith('/人生系统.md')) return route.continue();
    attempts++;
    if (attempts === 1) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: 'text/markdown', body: '# Resumed content' }).catch(() => {});
  });
  await openDesktop(page);
  const desktopWindow = await openMarkdown(page);
  await expect.poll(() => attempts).toBe(1);
  await desktopWindow.locator('[data-window-action="minimize"]').click();
  await expect(desktopWindow).toBeHidden();
  release?.();
  await page.getByRole('button', { name: '打开 人生系统', exact: true }).click();
  await expect(desktopWindow.getByRole('heading', { name: 'Resumed content' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('owned iframe pauses when minimized and resumes the same document without reloading', async ({ page }) => {
  await openDesktop(page);
  await page.getByRole('button', { name: '打开 组件库', exact: true }).click();
  await page.locator('[data-folder-entry="组件库/Cursor Reveal Hero.html"]').dblclick();
  const desktopWindow = page.locator('[data-macos-window="组件库/Cursor Reveal Hero.html"]');
  await expect(desktopWindow.locator('iframe')).toBeVisible();
  await expect(desktopWindow.frameLocator('iframe').locator('#stage')).toBeVisible();
  const frame = page.frames().find(candidate => decodeURIComponent(candidate.url()).endsWith('/Cursor Reveal Hero.html'));
  expect(frame).toBeTruthy();
  await frame!.evaluate(() => {
    const raf = window.requestAnimationFrame;
    const stats = { scheduled: 0, executed: 0 };
    Object.assign(window, { lifecycleMarker: 'same-document', lifecycleStates: [], lifecycleFrames: stats });
    window.requestAnimationFrame = callback => {
      stats.scheduled++;
      return raf(time => { stats.executed++; callback(time); });
    };
    window.addEventListener('message', event => {
      if (event.source === parent && event.origin === location.origin && event.data?.type === 'justin-kit:activity') {
        (window as any).lifecycleStates.push(event.data.active);
      }
    });
  });
  const stageBounds = (await desktopWindow.frameLocator('iframe').locator('#stage').boundingBox())!;
  await page.mouse.move(stageBounds.x + stageBounds.width / 3, stageBounds.y + stageBounds.height / 2);
  await expect.poll(() => frame!.evaluate(() => (window as any).lifecycleFrames.executed)).toBeGreaterThan(0);
  await desktopWindow.locator('[data-window-action="minimize"]').click();
  await expect.poll(() => frame!.evaluate(() => (window as any).lifecycleStates.at(-1))).toBe(false);
  const pausedFrames = await frame!.evaluate(() => ({ ...(window as any).lifecycleFrames }));
  const pausedPosition = await frame!.evaluate(() => document.documentElement.style.getPropertyValue('--cursor-x'));
  // Exercise the real listener while hidden: CSS alone must not be the reason RAF stops.
  await frame!.evaluate(() => document.getElementById('stage')!.dispatchEvent(
    new PointerEvent('pointermove', { clientX: 15, clientY: 25, bubbles: true }),
  ));
  await page.waitForTimeout(150);
  expect(await frame!.evaluate(() => ({ ...(window as any).lifecycleFrames }))).toEqual(pausedFrames);
  expect(await frame!.evaluate(() => document.documentElement.style.getPropertyValue('--cursor-x'))).toBe(pausedPosition);
  await page.locator('[data-folder-entry="组件库/Cursor Reveal Hero.html"]').dblclick();
  await expect.poll(() => frame!.evaluate(() => (window as any).lifecycleStates.at(-1))).toBe(true);
  await page.mouse.move(stageBounds.x + stageBounds.width * 2 / 3, stageBounds.y + stageBounds.height / 2);
  await expect.poll(() => frame!.evaluate(() => (window as any).lifecycleFrames.executed)).toBeGreaterThan(pausedFrames.executed);
  expect(await frame!.evaluate(() => (window as any).lifecycleMarker)).toBe('same-document');
});

test('desktop DOM removal disposes windows and reinsertion mounts one working set of handlers', async ({ page }) => {
  let markdownRequests = 0;
  page.on('request', request => { if (decodeURIComponent(request.url()).endsWith('/人生系统.md')) markdownRequests++; });
  await openDesktop(page);
  const first = await openMarkdown(page);
  await expect(first.locator('article')).toBeVisible();
  for (let round = 0; round < 3; round++) {
    await page.evaluate(() => {
      const root = document.querySelector('[data-macos-desktop]')!;
      Object.assign(window, { detachedDesktop: root, desktopParent: root.parentElement, desktopNext: root.nextSibling });
      root.remove();
    });
    await expect.poll(() => page.evaluate(() => (window as any).detachedDesktop.querySelectorAll('[data-macos-window]').length)).toBe(0);
    await page.evaluate(() => {
      const state = window as any;
      state.desktopParent.insertBefore(state.detachedDesktop, state.desktopNext);
    });
    const restored = await openMarkdown(page);
    await expect(restored.locator('article')).toBeVisible();
    await expect(page.locator('[data-macos-window]')).toHaveCount(1);
  }
  expect(markdownRequests).toBe(4);
});

test('dome keeps its visible frame in reduced motion, sleeps at zero size and wakes on resize', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    Object.assign(window, { domeFrames: 0 });
    CanvasRenderingContext2D.prototype.clearRect = function(...args) {
      if (this.canvas.matches('[data-symbol-dome-canvas]')) (window as any).domeFrames++;
      return Reflect.apply(clear, this, args);
    };
  });
  await page.goto('/os');
  const frames = () => page.evaluate(() => (window as any).domeFrames as number);
  await expect.poll(frames).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  const reducedFrames = await frames();
  await page.waitForTimeout(350);
  expect(await frames()).toBe(reducedFrames);
  const painted = await page.locator('[data-symbol-dome-canvas]').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  });
  expect(painted).toBe(true);
  const dome = page.locator('[data-symbol-dome-canvas]');
  const initialImage = await dome.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * .7, viewport.height * .7);
  await expect.poll(frames).toBeGreaterThan(reducedFrames);
  await page.waitForTimeout(150);
  const pointerFrames = await frames();
  expect(pointerFrames - reducedFrames).toBeLessThanOrEqual(2);
  expect(await dome.evaluate(element => (element as HTMLCanvasElement).toDataURL())).not.toBe(initialImage);
  await page.waitForTimeout(350);
  expect(await frames()).toBe(pointerFrames);
  await page.screenshot({ path: testInfo.outputPath('reduced-dome-pointer-feedback.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(frames).toBeGreaterThan(pointerFrames + 3);
  await page.locator('[data-symbol-dome-canvas]').evaluate(canvas => {
    (canvas as HTMLElement).style.width = '0px';
    (canvas as HTMLElement).style.height = '0px';
  });
  await page.waitForTimeout(150);
  const zeroFrames = await frames();
  await page.waitForTimeout(350);
  expect(await frames()).toBe(zeroFrames);
  await page.locator('[data-symbol-dome-canvas]').evaluate(canvas => {
    (canvas as HTMLElement).style.removeProperty('width');
    (canvas as HTMLElement).style.removeProperty('height');
  });
  await expect.poll(frames).toBeGreaterThan(zeroFrames + 3);
});

test('canvas reads saved positions once per mount while zoom and drag preserve the position-only storage boundary', async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    Object.assign(window, { canvasPositionReads: 0 });
    Storage.prototype.getItem = function(key) {
      if (key === 'justin-canvas-positions-v1') (window as any).canvasPositionReads++;
      return Reflect.apply(read, this, [key]);
    };
  });
  await page.goto('/canvas');
  const card = page.locator('.react-flow__node:has(.canvas-card--businesscard)');
  await expect(card).toBeVisible();
  const initialReads = await page.evaluate(() => (window as any).canvasPositionReads);
  expect(initialReads).toBe(1);
  for (let index = 0; index < 6; index++) {
    await page.getByRole('button', { name: index % 2 ? '缩小' : '放大', exact: true }).click();
  }
  await card.click({ trial: true });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 45, { steps: 16 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).canvasPositionReads)).toBe(initialReads);
  const positions = await page.evaluate(() => JSON.parse(localStorage.getItem('justin-canvas-positions-v1') || '{}'));
  expect(Object.keys(positions)).toHaveLength(1);
  expect(Object.keys(Object.values(positions)[0] as object).sort()).toEqual(['x', 'y']);
});

test('leaving canvas during an unreleased edge drag stops automatic viewport movement', async ({ page }) => {
  await page.goto('/canvas');
  const card = page.locator('.react-flow__node:has(.canvas-card--businesscard)');
  await card.click({ trial: true });
  const box = (await card.boundingBox())!, flow = (await page.locator('.canvas-flow').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(flow.x + flow.width - 3, flow.y + flow.height / 2, { steps: 16 });
  await page.waitForTimeout(150);
  // Keyboard navigation deliberately leaves the mouse button pressed.
  await page.locator('[data-canvas-return]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'room');
  await page.waitForTimeout(150);
  const viewport = page.locator('.react-flow__viewport');
  const position = await viewport.evaluate(element => (element as HTMLElement).style.transform);
  await page.waitForTimeout(350);
  expect(await viewport.evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  await page.mouse.up();
});
