import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { instrumentation } from './performance/browserInstrumentation.mjs';
import { sceneInstrumentation } from './performance/sceneInstrumentation.mjs';

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4325';
const label = process.env.PERF_LABEL ?? 'scene-current';
const output = process.env.PERF_OUTPUT ?? `.workspace/remediation/${label}.json`;
const repeats = Number(process.env.PERF_REPEATS ?? 3);
const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch({ headless: process.env.PERF_HEADFUL !== '1' });
const report = { label, base, measuredAt: new Date().toISOString(), environment: {
  node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model,
  browser: browser.version(), headless: process.env.PERF_HEADFUL !== '1', viewport, deviceScaleFactor: 1,
  reducedMotion: 'reduce', cpuThrottling: 1, lightingDate: '2026-09-25T06:00:00.000Z',
}, definitions: {
  offscreenDrawCalls: 'Draw calls with a non-default framebuffer. In this scene the offscreen passes are shadow maps; this is a proxy, not GPU time.',
  rectReads: 'Page-realm getBoundingClientRect calls on the scene or its descendants.',
  dimensionReads: 'Page-realm client/offset dimension getter calls in the scene. Counts are not proof of forced layout.',
  materialCreated: 'Cumulative cloned hover materials created by the gesture owner.',
  inputToDraw: 'Time from the first pending trusted pointermove to the next default-framebuffer WebGL draw submission, not compositor presentation.',
  latestInputToDraw: 'Time from the latest pointermove before that same draw submission.',
  dragBurst: '120 CDP trusted mouse moves dispatched concurrently after a trusted press; actual delivered pointermove count is recorded.',
}, runs: [] };
const quantiles = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, median: sorted[Math.floor(sorted.length * .5)] ?? null,
    p95: sorted[Math.floor(sorted.length * .95)] ?? null, max: sorted.at(-1) ?? null };
};

async function snapshot(page, cdp) {
  const [detail, metrics] = await Promise.all([
    page.evaluate(() => window.__sceneProbe.snapshot()), cdp.send('Performance.getMetrics'),
  ]);
  return { detail, metrics: Object.fromEntries(metrics.metrics.map(item => [item.name, item.value])) };
}

async function sample(page, cdp, action) {
  await page.evaluate(() => window.__sceneProbe.reset());
  const before = await snapshot(page, cdp), started = performance.now();
  await action();
  const after = await snapshot(page, cdp);
  const detail = after.detail;
  return { durationMs: performance.now() - started, before, after,
    summary: { pointerEvents: detail.pointerEvents, drawCalls: detail.drawCalls, offscreenDrawCalls: detail.offscreenDrawCalls,
      rectReads: detail.rectReads, dimensionReads: detail.dimensionReads,
      materialCreated: detail.materialCreated - before.detail.materialCreated,
      materialDisposed: detail.materialDisposed - before.detail.materialDisposed,
      layoutDuration: after.metrics.LayoutDuration - before.metrics.LayoutDuration,
      scriptDuration: after.metrics.ScriptDuration - before.metrics.ScriptDuration,
      taskDuration: after.metrics.TaskDuration - before.metrics.TaskDuration,
      firstInput: quantiles(detail.inputToDraw), latestInput: quantiles(detail.latestInputToDraw) } };
}

try {
  for (let repeat = 1; repeat <= repeats; repeat++) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.addInitScript(instrumentation);
    await context.addInitScript(sceneInstrumentation);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    try {
      await page.goto(`${base}/home`);
      await page.waitForFunction(() => document.querySelector('[data-studio-scene]')?.dataset.renderActive === 'true');
      await page.waitForTimeout(1000);
      const renderer = await page.evaluate(() => {
        const gl = document.querySelector('[data-studio-scene] canvas').getContext('webgl2');
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      });
      const idle = await sample(page, cdp, () => page.waitForTimeout(5200));
      const hover = await sample(page, cdp, async () => {
        for (let lap = 0; lap < 3; lap++) {
          for (const y of [350, 450, 550]) {
            await page.mouse.move(380, y); await page.mouse.move(1060, y, { steps: 40 });
            await page.mouse.move(380, y, { steps: 40 });
          }
        }
        await page.mouse.move(40, 60); await page.waitForTimeout(100);
      });
      if (!hover.summary.pointerEvents || !hover.after.detail.materialCreated) throw new Error('The hover probe did not exercise real scene materials');
      const dragBurst = await sample(page, cdp, async () => {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 680, y: 450 });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 680, y: 450, button: 'left', buttons: 1, clickCount: 1 });
        await Promise.all(Array.from({ length: 120 }, (_, index) => cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: 680 + (index + 1), y: 450 + (index + 1) * .25, button: 'left', buttons: 1,
        })));
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 800, y: 480, button: 'left', buttons: 0, clickCount: 1 });
        await page.waitForTimeout(250);
      });
      if (dragBurst.before.detail.cameraAngle === dragBurst.after.detail.cameraAngle) throw new Error('The drag probe did not move the studio camera');
      await mkdir(dirname(output), { recursive: true });
      await page.screenshot({ path: `${output.replace(/\.json$/, '')}-${repeat}.png` });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('[data-studio-explore]').focus();
      await page.keyboard.press('Enter');
      const surfaceTransition = await sample(page, cdp, async () => {
        await page.locator('[data-studio-action="computer"]').click();
        await page.waitForFunction(() => document.querySelector('[data-studio]')?.dataset.state === 'desktop');
      });
      surfaceTransition.reducedMotion = 'no-preference';
      report.runs.push({ repeat, renderer, idle, hover, dragBurst, surfaceTransition, errors });
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
      console.log(`${label}: repeat ${repeat}/${repeats} recorded`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
if (process.env.PERF_BUDGET_OUTPUT) {
  const flat = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'number' ? [[name, item]] : item && typeof item === 'object' ? flat(item, name) : [];
  });
  const scenarios = {};
  for (const name of ['idle', 'hover', 'dragBurst', 'surfaceTransition']) {
    const metrics = {};
    for (const run of report.runs) for (const [key, value] of flat(run[name].summary)) (metrics[key] ??= []).push(value);
    scenarios[name] = Object.fromEntries(Object.entries(metrics).map(([key, values]) => {
      const sorted = [...values].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
      const tolerance = Math.max(Math.abs(median) * .05, sorted.at(-1) - sorted[0]);
      return [key, { values, median, tolerance, upper: median + tolerance }];
    }));
  }
  await mkdir(dirname(process.env.PERF_BUDGET_OUTPUT), { recursive: true });
  await writeFile(process.env.PERF_BUDGET_OUTPUT, JSON.stringify({ source: output, frozenAt: new Date().toISOString(),
    rule: 'median + max(5% of median, max-min across baseline repeats)', scenarios }, null, 2) + '\n', { flag: 'wx' });
}
console.log(`Scene performance results: ${output}`);
