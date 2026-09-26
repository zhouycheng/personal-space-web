import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

const option = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const baseURL = option('--url') ?? 'http://127.0.0.1:4323';
const stage = option('--stage') ?? 'manual';
const output = option('--output') ?? `.workspace/remediation/ui-probes/${stage}.json`;
const repetitions = Number(option('--runs') ?? 3);
const sampleMs = 2_000;

function instrument() {
  const createCounters = () => ({ rafScheduled: 0, rafExecuted: 0, domeDraws: 0,
    layouts: { dome: 0, canvas: 0, gallery: 0, desktop: 0, other: 0 },
    computedStyles: { dome: 0, canvas: 0, gallery: 0, desktop: 0, other: 0 }, canvasStorageReads: 0 });
  let counters = createCounters();
  const classify = element => {
    if (element.matches('[data-symbol-dome-canvas]')) return 'dome';
    if (element.closest('.canvas-viewer')) return 'canvas';
    if (element.closest('[data-studio-gallery]')) return 'gallery';
    if (element.closest('[data-macos-desktop]')) return 'desktop';
    return 'other';
  };
  const measure = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function(...args) {
    counters.layouts[classify(this)]++;
    return Reflect.apply(measure, this, args);
  };
  const computed = window.getComputedStyle;
  window.getComputedStyle = function(element, ...args) {
    counters.computedStyles[classify(element)]++;
    return Reflect.apply(computed, this, [element, ...args]);
  };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => {
    counters.rafScheduled++;
    return raf(time => { counters.rafExecuted++; callback(time); });
  };
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function(...args) {
    if (this.canvas.matches('[data-symbol-dome-canvas]')) counters.domeDraws++;
    return Reflect.apply(clear, this, args);
  };
  const read = Storage.prototype.getItem;
  Storage.prototype.getItem = function(key) {
    if (key === 'justin-canvas-positions-v1') counters.canvasStorageReads++;
    return Reflect.apply(read, this, [key]);
  };
  window.__uiProbe = { reset: () => { counters = createCounters(); }, snapshot: () => structuredClone(counters) };
}

async function sample(page, action) {
  await page.evaluate(() => window.__uiProbe.reset());
  const started = performance.now();
  await action();
  const result = await page.evaluate(() => window.__uiProbe.snapshot());
  return { durationMs: Math.round(performance.now() - started), ...result };
}

async function settled(page, route, state) {
  await page.goto(new URL(route, baseURL).href);
  await page.waitForFunction(expected => document.querySelector('[data-studio]')?.getAttribute('data-state') === expected, state);
  await page.waitForTimeout(750);
  const close = page.locator('[data-os-home-hint]:not([hidden]) [data-os-hint-close]');
  if (await close.isVisible()) await close.click();
}

async function drag(page, locator, dx, dy) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Drag fixture is not visible');
  const x = box.x + box.width / 2, y = box.y + Math.min(20, box.height / 3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 48 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const results = [];
try {
  for (let run = 1; run <= repetitions; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.addInitScript(instrument);
    const page = await context.newPage();
    try {
      await settled(page, '/os', 'desktop');
      const environment = await page.evaluate(() => {
        const canvas = document.querySelector('[data-studio-scene] canvas');
        const gl = canvas?.getContext('webgl2');
        const debug = gl?.getExtension('WEBGL_debug_renderer_info');
        return { userAgent: navigator.userAgent, devicePixelRatio, graphics: gl ? {
          renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
          vendor: gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), version: gl.getParameter(gl.VERSION),
        } : null };
      });
      // Let the native hint-close pointer event's already queued feedback frame
      // finish before resetting counters for idle. Do not wait for a quiet loop.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const reducedDome = await sample(page, () => page.waitForTimeout(sampleMs));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(500);
      const normalDome = await sample(page, () => page.waitForTimeout(sampleMs));
      await page.locator('[data-symbol-dome-canvas]').evaluate(canvas => {
        canvas.style.width = '0px'; canvas.style.height = '0px';
      });
      await page.waitForTimeout(500);
      const zeroDome = await sample(page, () => page.waitForTimeout(sampleMs));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settled(page, '/canvas', 'canvas');
      await page.locator('.react-flow__node').first().waitFor({ state: 'visible' });
      const canvasZoom = await sample(page, async () => {
        for (let index = 0; index < 6; index++) {
          await page.getByRole('button', { name: index % 2 ? '缩小' : '放大', exact: true }).click();
        }
        await page.waitForTimeout(250);
      });
      const canvasDrag = await sample(page, () => drag(page, page.locator('.react-flow__node').first(), 80, 30));
      await settled(page, '/works', 'room');
      const galleryDrag = await sample(page, () => drag(page, page.locator('[data-gallery-viewport]'), -170, 0));
      await settled(page, '/os', 'desktop');
      const desktopDrag = await sample(page, () => drag(page, page.locator('[data-desktop-entry]').first(), -120, 30));
      results.push({ run, environment, reducedDome, normalDome, zeroDome, canvasZoom, canvasDrag, galleryDrag, desktopDrag });
      process.stdout.write(`UI ${stage}: repeat ${run}/${repetitions} complete\n`);
    } finally { await context.close(); }
  }
  const report = { stage, capturedAt: new Date().toISOString(), baseURL, viewport: { width: 1440, height: 900 },
    dpr: 1, browser: browser.version(), headless: !process.argv.includes('--headed'), host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus()[0]?.model },
    sampleMs, definitions: { layouts: 'Page-realm calls to getBoundingClientRect classified by owning element',
      rafExecuted: 'All page-realm RAF callbacks, not GPU execution time', domeDraws: '2D clearRect calls on the dome canvas',
      canvasStorageReads: 'Reads of the existing canvas positions key after mount', normalDome: 'Existing full-motion visual settings preserved' }, results };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Saved ${output}\n`);
} finally { await browser.close(); }
