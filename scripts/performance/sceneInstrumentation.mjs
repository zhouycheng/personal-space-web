/** Browser-side counters for the fixed scene workload; never changes scene state. */
export function sceneInstrumentation() {
  const empty = () => ({ pointerEvents: 0, rectReads: 0, dimensionReads: 0,
    drawCalls: 0, offscreenDrawCalls: 0, inputToDraw: [], latestInputToDraw: [] });
  let counters = empty(), firstInput, latestInput;
  const isScene = element => element instanceof Element &&
    (element.matches('[data-studio-scene]') || Boolean(element.closest('[data-studio-scene]')));
  const measure = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (isScene(this)) counters.rectReads++;
    return Reflect.apply(measure, this, args);
  };
  for (const [prototype, keys] of [[Element.prototype, ['clientWidth', 'clientHeight']], [HTMLElement.prototype, ['offsetWidth', 'offsetHeight']]]) {
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
      if (!descriptor?.get || !descriptor.configurable) continue;
      Object.defineProperty(prototype, key, { ...descriptor, get() {
        if (isScene(this)) counters.dimensionReads++;
        return Reflect.apply(descriptor.get, this, []);
      } });
    }
  }
  window.addEventListener('pointermove', event => {
    if (!isScene(event.target)) return;
    counters.pointerEvents++;
    latestInput = performance.now(); firstInput ??= latestInput;
  }, { capture: true });
  const framebuffers = new WeakMap();
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const prototype = window[name]?.prototype;
    if (!prototype) continue;
    const bind = prototype.bindFramebuffer;
    prototype.bindFramebuffer = function (target, framebuffer) {
      if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) framebuffers.set(this, framebuffer);
      return Reflect.apply(bind, this, [target, framebuffer]);
    };
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const draw = prototype[method];
      if (!draw) continue;
      prototype[method] = function (...args) {
        if (isScene(this.canvas)) {
          counters.drawCalls++;
          if (framebuffers.get(this)) counters.offscreenDrawCalls++;
          else if (firstInput !== undefined) {
            const now = performance.now();
            counters.inputToDraw.push(now - firstInput);
            counters.latestInputToDraw.push(now - latestInput);
            firstInput = latestInput = undefined;
          }
        }
        return Reflect.apply(draw, this, args);
      };
    }
  }
  window.__sceneProbe = {
    reset() { counters = empty(); firstInput = latestInput = undefined; },
    snapshot() {
      const mount = document.querySelector('[data-studio-scene]');
      return { ...structuredClone(counters), materialCreated: Number(mount?.dataset.hoverMaterialCreated ?? 0),
        materialDisposed: Number(mount?.dataset.hoverMaterialDisposed ?? 0), cameraAngle: mount?.dataset.cameraAngle,
        global: { ...window.__performanceStats, frames: undefined, longTasks: undefined } };
    },
  };
}
