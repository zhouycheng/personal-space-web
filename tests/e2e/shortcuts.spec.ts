import { expect, type Page } from 'playwright/test';
import { test, studioDestination } from './helpers/app';

test.use({ viewport: { width: 1024, height: 768 } });

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-cloud-entrance]')).toBeHidden({ timeout: 35000 });
}
async function home(page: Page) {
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'room');
  await expect(page.locator('[data-studio-scene] canvas')).toBeFocused();
}
async function doubleEscape(page: Page, pauseAt?: number) {
  // Driver roundtrips on software WebGL must not become part of the 400ms gesture.
  return page.evaluate(async pauseAt => {
    const target = document.activeElement!;
    for (const type of ['keydown', 'keyup', 'keydown', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', bubbles: true, cancelable: true }));
    const scene = document.querySelector<HTMLElement>('[data-studio-scene]')!;
    if (pauseAt !== null) await new Promise<void>(resolve => {
      const observe = () => {
        if (Number(scene.dataset.entranceProgress) <= pauseAt) { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); resolve(); }
        else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
    return { state: document.querySelector<HTMLElement>('[data-cloud-entrance]')!.dataset.state, progress: scene.dataset.entranceProgress };
  }, pauseAt ?? null);
}
async function htmlWindow(page: Page) {
  await ready(page, '/os');
  await page.locator('[data-desktop-entry]').filter({ hasText: '组件库' }).dblclick();
  const item = page.locator('.macos-folder-grid').getByRole('button', { name: 'Cursor Reveal Hero', exact: true });
  await item.focus(); await page.keyboard.press('Enter');
  const frame = page.frameLocator('.macos-window.is-active iframe');
  await expect(frame.locator('body')).toBeVisible();
  return frame;
}

test.beforeEach(async ({ page }) => { test.setTimeout(90000); await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('OS Escape returns home and re-entry preserves the existing windows and history', async ({ page }) => {
  await ready(page, '/home');
  await (await studioDestination(page, 'computer')).click();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'desktop');
  await page.locator('[data-desktop-entry]').first().dblclick();
  const windows = await page.locator('[data-macos-window]').count(); expect(windows).toBeGreaterThan(0);
  await page.keyboard.press('Escape'); await home(page);
  await (await studioDestination(page, 'computer')).click();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'desktop');
  await expect(page.locator('[data-macos-window]')).toHaveCount(windows);
  await page.keyboard.press('Escape'); await home(page);
  await page.goForward(); await expect(page).toHaveURL(/\/os$/);
  await page.keyboard.press('Escape'); await home(page);
});

test('canvas contents close before the page even when focus is outside the list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, '/canvas');
  const contents = page.getByRole('button', { name: '内容', exact: true });
  await contents.click(); await expect(contents).toHaveAttribute('aria-expanded', 'true');
  await contents.focus();
  await page.keyboard.down('Escape');
  await expect(contents).toHaveAttribute('aria-expanded', 'false'); await expect(contents).toBeFocused();
  await page.keyboard.down('Escape'); await expect(page).toHaveURL(/\/canvas$/);
  await page.keyboard.up('Escape'); await page.keyboard.press('Escape'); await home(page);
});

test('canvas keyboard focus and input composition retain their own behavior', async ({ page }) => {
  await ready(page, '/canvas');
  const node = page.locator('.react-flow__node').first(); await node.focus();
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.evaluate(view => new DOMMatrixReadOnly((view as HTMLElement).style.transform).a);
  await page.keyboard.press('Space'); await expect(node).toBeFocused();
  await expect.poll(() => viewport.evaluate(view => new DOMMatrixReadOnly((view as HTMLElement).style.transform).a)).toBeGreaterThan(before);
  await page.locator('#page-canvas').evaluate(root => {
    const input = document.createElement('textarea'); input.dataset.shortcutInput = ''; root.append(input); input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }));
  });
  await expect(page).toHaveURL(/\/canvas$/);
  await page.keyboard.press('Control+Escape'); await expect(page).toHaveURL(/\/canvas$/);
  await page.keyboard.press('Escape'); await home(page);
});

test('canvas Escape commits the displayed drag position before leaving', async ({ page }) => {
  await ready(page, '/canvas');
  const node = page.locator('.react-flow__node').first(); await node.dblclick();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const id = await node.getAttribute('data-id');
  const card = node.locator('.canvas-card').first(); const box = (await card.boundingBox())!;
  const point = { x: box.x + Math.min(box.width * .5, 60), y: box.y + Math.min(box.height * .5, 40) };
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 80, point.y + 50, { steps: 8 });
  await expect(node).toHaveClass(/dragging/);
  const displayed = await node.evaluate((node: HTMLElement) => { const position = new DOMMatrixReadOnly(node.style.transform); return { x: position.e, y: position.f }; });
  await page.keyboard.press('Escape'); await home(page);
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('justin-canvas-positions-v1')!)[id!], id);
  expect(saved.x).toBeCloseTo(displayed.x, 2); expect(saved.y).toBeCloseTo(displayed.y, 2);
  await page.mouse.move(point.x + 120, point.y + 90); await page.mouse.up();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('justin-canvas-positions-v1')!)[id!], id)).toEqual(saved);
});

test('file keyboard navigation and nested download Escape close exactly one layer', async ({ page }) => {
  await ready(page, '/works');
  const files = page.locator('[data-gallery-file]'); await files.first().focus();
  await page.keyboard.press('End'); await expect(page.locator('.gallery-item').last()).toHaveAttribute('data-file-position', 'current');
  await page.keyboard.press('Home'); await expect(page.locator('.gallery-item').first()).toHaveAttribute('data-file-position', 'current');
  const downloadContent = page.locator('[data-gallery-content]').filter({ has: page.locator('[data-project-download]') }).first();
  const fileId = await downloadContent.getAttribute('data-gallery-content');
  await page.locator(`[data-gallery-file="${fileId}"]`).focus(); await page.keyboard.press('Enter');
  const dialog = page.locator('[data-gallery-detail]'); await expect(dialog).toBeVisible();
  const download = dialog.locator('[data-project-download]').filter({ visible: true }).first();
  await download.locator('[data-download-toggle]').click(); await expect(download.locator('[data-download-menu]')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(download.locator('[data-download-menu]')).toBeHidden();
  await expect(dialog).toBeVisible(); await expect(page).toHaveURL(/\/works$/);
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(page).toHaveURL(/\/works$/);
  await page.keyboard.press('Escape'); await home(page);
});

test('journal Escape closes the native image modal, folds the book, then exits', async ({ page }) => {
  await ready(page, '/home'); await (await studioDestination(page, 'diary')).click();
  const journal = page.locator('[data-journal-root]'); await expect(journal).toHaveAttribute('data-phase', 'reading');
  await page.keyboard.press('Home'); await page.keyboard.press('='); await expect(journal).toHaveClass(/is-zoomed/);
  await page.keyboard.press('0'); await expect(journal).not.toHaveClass(/is-zoomed/);
  const modal = page.locator('[data-journal-image]');
  await modal.evaluate((dialog: HTMLDialogElement) => dialog.showModal());
  // Exercise the native cancel path as well as registered image activation.
  await page.keyboard.press('Escape'); await expect(modal).toBeHidden(); await expect(journal).toHaveAttribute('data-phase', 'reading');
  await page.keyboard.press('Escape'); await expect(journal).toHaveAttribute('data-phase', 'observing');
  await page.keyboard.press('Escape'); await home(page);
});

test('startup Escape redirects the pending journal to home', async ({ page }) => {
  await page.goto('/journal', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.alpha-shell')).toHaveAttribute('data-sky-phase', /\w+/);
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('[data-cloud-entrance]')).toBeHidden({ timeout: 35000 }); await home(page);
});

test('explore keyboard tabs and fishing Escape restore focus without leaving home', async ({ page }) => {
  await ready(page, '/home'); await page.locator('[data-studio-explore]').click();
  const panel = page.locator('.studio-panel'), view = panel.locator('[data-studio-tab="view"]');
  await view.focus(); await page.keyboard.press('ArrowRight');
  await expect(panel.locator('[data-studio-tab="objects"]')).toBeFocused();
  await page.keyboard.press('Home'); await expect(view).toBeFocused();
  await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(page.locator('[data-studio-explore]')).toBeFocused();
  await page.locator('[data-studio-explore]').click(); await panel.locator('[data-studio-tab="objects"]').click();
  await panel.locator('[data-studio-action="fishing"]').click();
  const fishing = page.locator('[data-fishing]'); await expect(fishing).toBeVisible();
  await page.keyboard.press('Escape'); await expect(fishing).toBeHidden(); await home(page);
  await page.keyboard.press('Escape'); await home(page);
});

test('iframe Escape respects native child dialogs and consumed input after reload and minimize', async ({ page }) => {
  const frame = await htmlWindow(page);
  await frame.locator('body').evaluate(body => {
    const dialog = document.createElement('dialog'); dialog.innerHTML = '<button>关闭</button>'; body.append(dialog); dialog.showModal();
  });
  await page.keyboard.press('Escape'); await expect(frame.locator('dialog')).not.toHaveAttribute('open', ''); await expect(page).toHaveURL(/\/os$/);
  await frame.locator('body').evaluate(body => {
    body.tabIndex = -1; body.focus(); window.addEventListener('keydown', event => event.preventDefault(), { once: true });
  });
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/os$/);
  const activeWindow = page.locator('.macos-window.is-active');
  await activeWindow.locator('[data-window-action="minimize"]').click();
  await page.locator('[data-desktop-entry]').filter({ hasText: '组件库' }).dblclick();
  const item = page.locator('.macos-window.is-active .macos-folder-grid').getByRole('button', { name: 'Cursor Reveal Hero', exact: true });
  await item.focus(); await page.keyboard.press('Enter');
  await page.locator('.macos-window.is-active iframe').evaluate((iframe: HTMLIFrameElement) => new Promise<void>(resolve => {
    iframe.addEventListener('load', () => resolve(), { once: true }); iframe.src = iframe.src;
  }));
  await expect(frame.locator('body')).toBeVisible(); await frame.locator('body').evaluate(body => { body.tabIndex = -1; body.focus(); });
  await page.keyboard.press('Escape'); await home(page);
});

test('temporary debug hot corner uses shared modifiers and Escape', async ({ page }) => {
  await ready(page, '/home');
  const mod = await page.evaluate(() => /Macintosh|Mac OS X|iPhone|iPad/.test(navigator.userAgent) ? 'Meta' : 'Control');
  await page.keyboard.down(mod); await page.keyboard.down('Shift'); await page.mouse.move(10, page.viewportSize()!.height - 10);
  const panel = page.locator('[data-scene-performance-overlay]'); await expect(panel).toBeVisible();
  await page.keyboard.up('Shift'); await page.keyboard.up(mod); await page.keyboard.press('Escape');
  await expect(panel).toBeHidden(); await expect(page).toHaveURL(/\/home$/);
});

test('home double Escape returns to a ready entrance without loading and supports repeated entry', async ({ page }) => {
  test.setTimeout(120000);
  // Software WebGL spends substantially longer on three complete entry cycles.
  test.slow();
  await ready(page, '/home'); await home(page);
  const cloud = page.locator('[data-cloud-entrance]'), scene = page.locator('[data-studio-scene]');
  const prepared = await scene.getAttribute('data-startup-timings');
  await scene.locator('canvas').evaluate(canvas => canvas.setAttribute('data-shortcut-preserved', 'true'));
  await cloud.evaluate(root => {
    Reflect.set(window, 'shortcutCloudStates', []);
    new MutationObserver(records => Reflect.get(window, 'shortcutCloudStates').push(...records.map(record => record.oldValue), root.getAttribute('data-state')))
      .observe(root, { attributes: true, attributeFilter: ['data-state'], attributeOldValue: true });
  });
  await page.keyboard.down('Escape'); await page.keyboard.down('Escape'); await page.keyboard.up('Escape');
  await expect(cloud).toBeHidden();
  await page.locator('[data-studio-explore]').click(); await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await expect(cloud).toBeHidden();
  await doubleEscape(page);
  for (const enter of ['Enter', 'Space', 'click']) {
    await expect(cloud).toHaveAttribute('data-state', 'ready'); await expect(cloud).toBeFocused();
    await expect(cloud.locator('[data-cloud-progress]')).toBeHidden();
    await expect(cloud.locator('[data-cloud-status]')).toHaveText('点击拨开云雾');
    await expect(page).toHaveURL(/\/home$/);
    if (enter === 'click') await cloud.click(); else await page.keyboard.press(enter);
    await expect(cloud).toBeHidden(); await home(page);
    await expect(scene.locator('canvas[data-shortcut-preserved]')).toHaveCount(1);
    expect(await scene.getAttribute('data-startup-timings')).toBe(prepared);
    if (enter !== 'click') {
      await page.keyboard.press('Escape'); await expect(cloud).toBeHidden(); await doubleEscape(page);
    }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'shortcutCloudStates'))).not.toContain('loading');
});

test('home retreat follows the entrance timeline and pauses across BFCache', async ({ page }, info) => {
  test.setTimeout(120000);
  test.slow();
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await ready(page, '/home'); await home(page);
  const cloud = page.locator('[data-cloud-entrance]'), scene = page.locator('[data-studio-scene]');
  const paused = await doubleEscape(page, .8); expect(paused.state).toBe('returning');
  await expect(cloud).toHaveAttribute('data-state', 'returning'); await expect(cloud.locator('[data-cloud-progress]')).toBeHidden();
  await expect(cloud.locator('[data-cloud-status]')).toHaveText('点击拨开云雾');
  expect(Number(paused.progress)).toBeGreaterThan(0);
  expect(Number(paused.progress)).toBeLessThanOrEqual(.8);
  await page.screenshot({ path: info.outputPath('home-retreat-middle.png') });
  expect(await scene.getAttribute('data-entrance-progress')).toBe(paused.progress);
  await page.keyboard.press('Escape'); expect(await scene.getAttribute('data-entrance-progress')).toBe(paused.progress);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(cloud).toHaveAttribute('data-state', 'ready'); await expect(scene).toHaveAttribute('data-entrance-progress', '0');
  await expect(cloud).toBeFocused(); await page.screenshot({ path: info.outputPath('home-retreat-ready.png') });
  await cloud.click(); await expect(cloud).toBeHidden(); await home(page);
  await expect(scene).not.toHaveAttribute('data-entrance-progress');
});

test('Escape cancels an OS entry animation and leaves no late projection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await ready(page, '/home');
  const transition = await page.evaluate(() => {
    document.querySelector<HTMLAnchorElement>('.studio-direct-links [data-studio-action="computer"]')!.click();
    const state = document.querySelector<HTMLElement>('[data-studio]')!.dataset.state;
    // Keep Escape in the entry task to exercise a live transition.
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escape);
    return { state, consumed: escape.defaultPrevented };
  });
  expect(transition).toEqual({ state: 'entering', consumed: true }); await home(page);
  await expect(page.locator('[data-os-fullscreen]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-os-fullscreen]')).not.toHaveClass(/studio-projecting/);
});

test('BFCache events and shell reinsertion retain one working shortcut registration', async ({ page }) => {
  test.setTimeout(120000);
  await ready(page, '/canvas');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/canvas$/);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.keyboard.press('Escape'); await home(page);
  await page.evaluate(async () => {
    Reflect.set(window, 'shortcutDocument', 'retained');
    const shell = document.querySelector('.alpha-shell')!, next = shell.nextSibling, parent = shell.parentNode!;
    shell.remove(); await new Promise(resolve => setTimeout(resolve, 0)); parent.insertBefore(shell, next);
  });
  await expect(page.locator('[data-cloud-entrance]')).toBeHidden({ timeout: 35000 });
  await expect(page.locator('[data-studio-scene] canvas')).toHaveCount(1);
  await (await studioDestination(page, 'canvas')).click();
  expect(await page.evaluate(() => Reflect.get(window, 'shortcutDocument'))).toBe('retained');
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'canvas');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '内容', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/canvas$/);
  await page.keyboard.press('Escape'); await home(page);
});
