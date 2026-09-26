import { instrumentation } from "./performance/browserInstrumentation.mjs";
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4326';
const label = process.env.PERF_LABEL ?? 'current';
const output = process.env.PERF_OUTPUT ?? `.workspace/remediation/${label}.json`;
const repeats = Number(process.env.PERF_REPEATS ?? 3);
const idleMs = Number(process.env.PERF_IDLE_MS ?? 60_000);
const cycles = Number(process.env.PERF_CYCLES ?? 30);
let service;
if (!process.env.PERF_URL) {
  service = spawn(process.execPath, ['dist/server/entry.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '4326', NODE_ENV: 'production' }, stdio: 'inherit',
  });
  const deadline = performance.now() + 30_000;
  let ready = false;
  while (performance.now() < deadline && service.exitCode === null) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) { service.kill(); throw new Error('Performance server did not become healthy'); }
}
const browser = await chromium.launch({ headless: process.env.PERF_HEADFUL !== '1' }).catch(error => {
  service?.kill();
  throw error;
});
const report = { label, base, measuredAt: new Date().toISOString(), environment: {
  node: process.version, platform: process.platform, architecture: process.arch,
  cpu: os.cpus()[0]?.model, browser: browser.version(), headless: process.env.PERF_HEADFUL !== '1',
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpuThrottling: 1,
  lightingDate: '2026-09-25T06:00:00.000Z',
}, runs: [] };


async function metrics(page, cdp) {
  const [performance, dom, detail] = await Promise.all([
    cdp.send('Performance.getMetrics'), cdp.send('Memory.getDOMCounters'),
    page.evaluate(() => {
      const canvas = document.querySelector('[data-studio-scene] canvas');
      const gl = canvas?.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      const stats = window.__performanceStats;
      const sorted = stats.frames.filter(n => n > 0 && n < 1000).sort((a, b) => a - b);
      return { ...stats, frames: undefined, frameSamples: sorted.length,
        frameP50: sorted[Math.floor(sorted.length * .5)] ?? null,
        frameP95: sorted[Math.floor(sorted.length * .95)] ?? null,
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        studio: document.querySelector('[data-studio]')?.dataset.state,
        canvasCount: document.querySelectorAll('[data-studio-scene] canvas').length,
        journal: canvas?.dataset.journalPhase,
        diagnostics: document.querySelector('[data-studio-scene]')?.dataset,
      };
    }),
  ]);
  return { ...Object.fromEntries(performance.metrics.map(m => [m.name, m.value])), dom, detail };
}

async function navigate(page, route, state) {
  // History replay exercises the actual application route handler, without invoking a controller.
  await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')); }, route);
  await page.waitForFunction(state => document.querySelector('[data-studio]')?.dataset.state === state, state);
  if (route === '/canvas') await page.locator('.react-flow__node').first().waitFor();
}

try {
  for (let repeat = 0; repeat < repeats; repeat++) {
    const run = { repeat, scenarios: [], errors: [] };
    report.runs.push(run);
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: report.environment.viewport,
        deviceScaleFactor: 1, reducedMotion });
      await context.addInitScript(instrumentation);
      const page = await context.newPage();
      page.on('pageerror', error => run.errors.push(error.message));
      const requests = [];
      page.on('request', request => requests.push({ url: request.url(), at: performance.now() }));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.goto(`${base}/home`);
      await page.waitForFunction(() => document.querySelector('[data-studio-scene] canvas:not([hidden])'));
      await page.waitForTimeout(1000);
      const before = await metrics(page, cdp);
      await page.waitForTimeout(idleMs);
      const after = await metrics(page, cdp);
      run.scenarios.push({ name: 'home-idle', reducedMotion, durationMs: idleMs, before, after });
      await mkdir(path.dirname(output), { recursive: true });
      await page.screenshot({ path: path.join(path.dirname(output), `${label}-${repeat}-${reducedMotion}-home.png`) });
      if (reducedMotion === 'reduce') {
        const checkpoints = [];
        for (let cycle = 1; cycle <= cycles; cycle++) {
          for (const [route, state] of [['/os', 'desktop'], ['/canvas', 'canvas'], ['/journal', 'journal'], ['/home', 'room']]) {
            await navigate(page, route, state);
            await page.waitForTimeout(200);
          }
          if (cycle % 10 === 0 || cycle === cycles) {
            await cdp.send('HeapProfiler.collectGarbage');
            checkpoints.push({ cycle, metrics: await metrics(page, cdp) });
          }
        }
        const activityStart = requests.length;
        await page.waitForTimeout(13_000);
        run.scenarios.push({ name: 'route-cycles', reducedMotion, cycles, checkpoints,
          inactiveActivityRequests: requests.slice(activityStart).filter(r => r.url.includes('/api/activity')).length });
        await navigate(page, '/journal', 'journal');
        await page.waitForTimeout(500);
        const canvas = page.locator('canvas[data-journal-phase]');
        await page.waitForFunction(() => document.querySelector('[data-journal-root]')?.getAttribute('data-phase') === 'observing');
        await canvas.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-journal-root]')?.getAttribute('data-phase') === 'reading');
        run.scenarios.push({ name: 'journal-open', metrics: await metrics(page, cdp) });
        await page.screenshot({ path: path.join(path.dirname(output), `${label}-${repeat}-journal.png`) });
      }
      await context.close();
      await writeFile(output, JSON.stringify(report, null, 2));
    }
    console.log(`${label}: repeat ${repeat + 1}/${repeats} recorded`);
  }
} finally {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  await browser.close();
  service?.kill();
}
console.log(`Performance results: ${output}`);
