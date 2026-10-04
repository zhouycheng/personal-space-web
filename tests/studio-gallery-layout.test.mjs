import test from 'node:test';
import assert from 'node:assert/strict';
import { setupStudioGallery } from '../src/presentation/ui/studio/studioGallery.ts';

test('gallery measures unscaled cards, reuses layout, and does not interrupt scrolling on unrelated page updates', () => {
  const names = ['window', 'document', 'matchMedia', 'getComputedStyle', 'MutationObserver', 'ResizeObserver', 'cancelAnimationFrame'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let active = false, layoutReads = 0, mutation, resize;
  const positions = [], cards = Array.from({ length: 3 }, (_, index) => ({
    dataset: { filePosition: index ? 'right' : 'current' },
    get offsetWidth() { layoutReads++; return 300; },
    getBoundingClientRect() { throw new Error('Entrance transforms must not affect layout measurements'); },
  }));
  const viewport = Object.assign(new EventTarget(), {
    scrollLeft: 0, clientWidth: 800, scrollWidth: 1528,
    classList: { remove() {} },
    scrollTo(options) { positions.push(options); this.scrollLeft = options.left; },
  });
  const page = { classList: { contains: () => active } };
  const dialog = Object.assign(new EventTarget(), { open: false });
  const track = {};
  const root = Object.assign(new EventTarget(), {
    querySelector: selector => ({ '[data-gallery-viewport]': viewport, '.gallery-track': track, '[data-gallery-detail]': dialog })[selector],
    querySelectorAll: () => cards,
    closest: () => page,
  });
  const reduce = Object.assign(new EventTarget(), { matches: false });
  Object.assign(globalThis, {
    window: new EventTarget(), document: Object.assign(new EventTarget(), { hidden: false }),
    matchMedia: () => reduce, getComputedStyle: () => ({ gap: '64px' }), cancelAnimationFrame() {},
    MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} disconnect() {} },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() {} },
  });
  let dispose;
  try {
    dispose = setupStudioGallery(root);
    active = true; mutation();
    assert.equal(layoutReads, 1);
    const key = new Event('keydown'); Object.assign(key, { key: 'ArrowRight' });
    viewport.dispatchEvent(key);
    assert.deepEqual(positions.at(-1), { left: 364, behavior: 'smooth' });
    assert.equal(layoutReads, 1);
    const before = positions.length;
    mutation();
    assert.equal(positions.length, before, 'Repeated active class notifications must not snap an ongoing animation');
    viewport.clientWidth = 600; resize();
    assert.equal(layoutReads, 2);
    assert.deepEqual(positions.at(-1), { left: 364, behavior: 'instant' });
    assert.equal(cards[1].dataset.filePosition, 'current');
    active = false; mutation(); active = true; mutation();
    assert.equal(layoutReads, 3);
    assert.equal(positions.at(-1).left, 364, 'Reopening keeps the selected card');
  } finally {
    dispose?.();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
