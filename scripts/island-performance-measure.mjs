import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4327';
const label = process.env.PERF_LABEL ?? 'current';
const directory = `.workspace/performance-upgrade/${label}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: false });
const report = { label, base, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5,
  browser: browser.version(), lighting: '2026-10-04T06:00:00.000Z', runs: [],
  definitions: { frameGap: 'Time between render submissions, not compositor presentation or GPU time.',
    inputToRender: 'Latest trusted pointer/wheel event to the next render submission; excludes intentional camera settling.' } };
try {
  for (let repeat = 1; repeat <= 3; repeat++) {
    const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: 1.5, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      sessionStorage.setItem('justin-entrance-completed','1');
      const RealDate = Date;
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : ['2026-10-04T06:00:00.000Z'])); }
        static now() { return new RealDate('2026-10-04T06:00:00.000Z').getTime(); }
      };
      const probe = window.__islandProbe = { samples: [], pending: undefined };
      for (const type of ['pointermove', 'wheel']) addEventListener(type, event => {
        if (event.isTrusted && event.target.closest?.('[data-studio-scene]')) probe.pending = performance.now();
      }, { capture: true, passive: true });
      window.__THREE_DEVTOOLS__ = new EventTarget();
      const observed = new WeakSet();
      window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
        const object = event.detail;
        if (observed.has(object)) return;
        observed.add(object);
        if (object.isScene) probe.scene = object;
        if (!object.isWebGLRenderer) return;
        probe.renderer = object;
        const render = object.render;
        let auxiliaryCPU = 0;
        object.render = function (scene, camera) {
          // Count one sample per displayed frame; renderer.info includes auxiliary passes.
          if (this.getRenderTarget()) {
            const start = performance.now();
            const result = render.call(this, scene, camera);
            auxiliaryCPU += performance.now() - start;
            return result;
          }
          const start = performance.now(), input = probe.pending;
          probe.pending = undefined;
          const result = render.call(this, scene, camera);
          probe.samples.push({ time: start, cpu: performance.now() - start + auxiliaryCPU,
            input: input === undefined ? undefined : start - input,
            calls: object.info.render.calls, triangles: object.info.render.triangles });
          auxiliaryCPU = 0;
          return result;
        };
      });
    });
    await page.goto(`${base}/home`);
    await page.waitForFunction(() => window.__islandProbe?.renderer && document.querySelector('[data-studio-scene]')?.dataset.renderActive === 'true');
    await page.waitForTimeout(2000);
    const environment = await page.evaluate(() => {
      const renderer = window.__islandProbe.renderer, gl = renderer.getContext();
      return { renderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL),
        pixelRatio: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height] };
    });
    if (/SwiftShader|llvmpipe/i.test(environment.renderer)) throw new Error('Hardware rendering is required for this benchmark');
    async function sample(name, action) {
      await page.evaluate(() => { window.__islandProbe.samples = []; window.__islandProbe.pending = undefined; });
      await action();
      const metrics = await page.evaluate(() => {
        const samples = window.__islandProbe.samples;
        const quantiles = values => {
          values.sort((a, b) => a - b);
          return { median: values[Math.floor(values.length * .5)] ?? null,
            p95: values[Math.floor(values.length * .95)] ?? null, max: values.at(-1) ?? null };
        };
        return { frames: samples.length, frameGap: quantiles(samples.slice(1).map((s, i) => s.time - samples[i].time)),
          renderCPU: quantiles(samples.map(s => s.cpu)), calls: quantiles(samples.map(s => s.calls)),
          triangles: quantiles(samples.map(s => s.triangles)), inputToRender: quantiles(samples.flatMap(s => s.input === undefined ? [] : [s.input])),
          over50ms: samples.slice(1).filter((s, i) => s.time - samples[i].time > 50).length,
          raw: samples };
      });
      report.runs.push({ repeat, name, environment, errors: [...errors], ...metrics });
      console.log(JSON.stringify({ repeat, name, ...metrics, raw: undefined }));
    }
    await sample('idle', () => page.waitForTimeout(2400));
    await sample('orbit-reverse', async () => {
      await page.mouse.move(680, 450); await page.mouse.down();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60 * Math.PI * 2;
        await page.mouse.move(680 + Math.sin(t) * 180, 450 + Math.sin(t) * 55);
        await page.waitForTimeout(16);
      }
      await page.mouse.up(); await page.waitForTimeout(400);
    });
    await sample('zoom-reverse', async () => {
      for (let i = 0; i < 30; i++) {
        await page.mouse.move(660 + i * 6, 590 + i % 4 * 4);
        await page.mouse.wheel(0, i < 15 ? -14 : 14);
      }
      await page.waitForTimeout(400);
    });
    // Freeze environmental motion for comparable visual checks only, after timing.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${directory}/overview-${repeat}.png` });
    await page.close();
    await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); }
