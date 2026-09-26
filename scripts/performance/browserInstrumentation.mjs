export function instrumentation() {
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-09-25T06:00:00.000Z'])); }
    static now() { return new RealDate('2026-09-25T06:00:00.000Z').getTime(); }
  };
  const stats = { rafScheduled: 0, rafExecuted: 0, drawCalls: 0, textureCreated: 0,
    textureDeleted: 0, bufferCreated: 0, bufferDeleted: 0, frames: [], longTasks: [] };
  let previous = 0;
  const request = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    stats.rafScheduled++;
    return request(time => {
      stats.rafExecuted++;
      if (time !== previous) { if (previous) stats.frames.push(time - previous); previous = time; }
      callback(time);
    });
  };
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const proto = window[name]?.prototype;
    if (!proto) continue;
    for (const [method, key] of [['drawElements', 'drawCalls'], ['drawArrays', 'drawCalls'],
      ['drawElementsInstanced', 'drawCalls'], ['drawArraysInstanced', 'drawCalls'],
      ['createTexture', 'textureCreated'], ['deleteTexture', 'textureDeleted'],
      ['createBuffer', 'bufferCreated'], ['deleteBuffer', 'bufferDeleted']]) {
      const original = proto[method];
      if (!original) continue;
      proto[method] = function (...args) { stats[key]++; return Reflect.apply(original, this, args); };
    }
  }
  try { new PerformanceObserver(list => stats.longTasks.push(...list.getEntries().map(e => e.duration)))
    .observe({ type: 'longtask', buffered: true }); } catch {}
  window.__performanceStats = stats;
}
