import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivitySource, parseActivitySnapshot } from '../src/justin-kit/components/local-activity-status/runtime/activitySource.ts';
import { createDesktopContentRenderer } from '../src/justin-kit/components/macos-desktop/runtime/desktopContent.js';
import { createDomInstances } from '../src/justin-kit/runtime/domInstances.ts';
import { observeElementActivity } from '../src/justin-kit/runtime/elementActivity.ts';
import { createDesktopIconInteraction } from '../src/justin-kit/components/macos-desktop/runtime/desktopIconInteraction.js';
import { drawDomeFrame } from '../src/justin-kit/components/symbol-dome-background/domeRenderer.ts';

test('reduced-motion pointer feedback draws its final pose without scheduling interpolation frames', () => {
  const state = { width: 1000, height: 600, rotation: .3, lookX: 0, lookY: 0,
    pointerX: 990, pointerY: 500, hasPointer: true, pointerInside: true };
  const reduced = drawDomeFrame({}, [], state, 500, .016, true);
  assert.equal(reduced.settling, false);
  assert.equal(reduced.lookX, 1);
  assert.ok(Math.abs(reduced.rotation - state.rotation) < Number.EPSILON);
  const normal = drawDomeFrame({}, [], state, 500, .016, false);
  assert.equal(normal.settling, true);
  assert.equal(normal.lookX, .035);
  assert.ok(normal.rotation > state.rotation);
});

test('activity stream is shared by active consumers and rejects late callbacks after last unsubscribe', () => {
  const connections = [];
  const source = createActivitySource(() => {
    const stream = { onopen: null, onmessage: null, onerror: null, closed: 0, close() { this.closed++; } };
    connections.push(stream);
    return stream;
  });
  const first = [], second = [];
  const stopFirst = source.subscribe(state => first.push(state));
  const stopSecond = source.subscribe(state => second.push(state));
  assert.equal(connections.length, 1);
  const stream = connections[0];
  stream.onmessage({ data: JSON.stringify({ appName: 'Editor', text: null, observedAt: 1, receivedAt: 1, expiresAt: Date.now() + 60_000 }) });
  assert.equal(first.at(-1).snapshot.appName, 'Editor');
  assert.equal(second.at(-1).snapshot.appName, 'Editor');
  stopFirst();
  assert.equal(stream.closed, 0);
  const late = stream.onmessage;
  stopSecond();
  stopSecond();
  assert.equal(stream.closed, 1);
  const count = second.length;
  late({ data: 'null' });
  assert.equal(second.length, count);
  const stopReentry = source.subscribe(state => first.push(state));
  assert.equal(connections.length, 2);
  assert.equal(first.at(-1).status, 'loading');
  stopReentry();
});

test('activity payload validation rejects incomplete data instead of retaining an invalid snapshot', () => {
  assert.equal(parseActivitySnapshot(null), null);
  assert.throws(() => parseActivitySnapshot({ appName: 'Editor', expiresAt: 123 }), /Invalid activity/);
  assert.throws(() => parseActivitySnapshot({ appName: '', observedAt: 1, receivedAt: 1, expiresAt: 2, text: null }), /Invalid activity/);
});

test('identical callback functions still represent distinct activity consumers', () => {
  let closed = 0;
  const source = createActivitySource(() => ({ onopen: null, onmessage: null, onerror: null, close() { closed++; } }));
  const listener = () => {};
  const a = source.subscribe(listener), b = source.subscribe(listener);
  a();
  assert.equal(closed, 0);
  b();
  assert.equal(closed, 1);
});

test('DOM registry disposes detached instances, remounts them, and preserves BFCache instances', () => {
  const original = { document: globalThis.document, window: globalThis.window, MutationObserver: globalThis.MutationObserver };
  const win = new EventTarget();
  const doc = new EventTarget();
  const element = { isConnected: true };
  const observers = [];
  Object.assign(doc, { documentElement: {}, readyState: 'complete', querySelectorAll: () => element.isConnected ? [element] : [] });
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } };
  try {
    let created = 0, disposed = 0;
    const registry = createDomInstances('[fixture]', () => { created++; return () => { disposed++; }; });
    registry.init(); registry.init();
    assert.equal(created, 1);
    element.isConnected = false;
    observers[0].callback();
    assert.equal(disposed, 1);
    element.isConnected = true;
    observers[0].callback();
    assert.equal(created, 2);
    const hide = new Event('pagehide');
    Object.defineProperty(hide, 'persisted', { value: true });
    win.dispatchEvent(hide);
    assert.equal(disposed, 1);
    win.dispatchEvent(new Event('pagehide'));
    assert.equal(disposed, 2);
    assert.equal(observers[0].disconnected, true);
    registry.destroy();
    assert.equal(disposed, 2);
  } finally { Object.assign(globalThis, original); }
});

test('element activity pauses for hidden ancestors, visibility and BFCache, then resumes once', () => {
  const original = { document: globalThis.document, window: globalThis.window, MutationObserver: globalThis.MutationObserver };
  const win = new EventTarget(), doc = new EventTarget();
  doc.hidden = false;
  let hidden = false;
  const element = { isConnected: true, parentElement: null, closest: () => hidden ? {} : null };
  let changed;
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.MutationObserver = class { constructor(callback) { changed = callback; } observe() {} disconnect() {} };
  try {
    const values = [];
    const stop = observeElementActivity(element, value => values.push(value));
    hidden = true; changed();
    hidden = false; changed();
    win.dispatchEvent(new Event('pagehide'));
    win.dispatchEvent(new Event('pageshow'));
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('pageshow'));
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    stop(); stop();
    assert.deepEqual(values, [true, false, true, false, true, false, true, false]);
  } finally { Object.assign(globalThis, original); }
});

test('decorative aria-hidden components render while their host is visible', () => {
  const original = { document: globalThis.document, window: globalThis.window, MutationObserver: globalThis.MutationObserver };
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  let changed, hostHidden = false;
  const host = { parentElement: null, closest: () => hostHidden ? host : null };
  const element = { isConnected: true, parentElement: host, closest: selector => selector.includes('aria-hidden') ? element : null };
  globalThis.MutationObserver = class { constructor(callback) { changed = callback; } observe() {} disconnect() {} };
  try {
    const values = [];
    const stop = observeElementActivity(element, value => values.push(value));
    assert.deepEqual(values, [true]);
    hostHidden = true; changed();
    assert.deepEqual(values, [true, false]);
    hostHidden = false; changed();
    stop();
    assert.deepEqual(values, [true, false, true, false]);
  } finally { Object.assign(globalThis, original); }
});

test('closing or pausing Markdown cancels its request and cannot render a delayed failure', async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const requests = [];
  const body = { className: '', classList: { add() {} }, writes: 0, replaceChildren() { this.writes++; }, append() {} };
  globalThis.document = { createElement() { return { className: '', textContent: '' }; } };
  globalThis.fetch = (_, options) => new Promise((resolve, reject) => requests.push({ resolve, reject, signal: options.signal }));
  try {
    const renderer = createDesktopContentRenderer({});
    const content = renderer({ entry: { window: { renderer: 'markdown', contentUrl: '/readme.md' } }, el: { isConnected: true }, body });
    content.resume();
    assert.equal(requests.length, 1);
    content.pause();
    assert.equal(requests[0].signal.aborted, true);
    const writes = body.writes;
    requests[0].reject(new Error('late failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(body.writes, writes);
    content.resume();
    assert.equal(requests.length, 2);
    content.dispose();
    content.dispose();
    assert.equal(requests[1].signal.aborted, true);
    const disposedWrites = body.writes;
    requests[1].reject(new Error('late failure after close'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(body.writes, disposedWrites);
    content.resume();
    assert.equal(requests.length, 2);
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test('icon drag returning to its start within one frame never becomes a window-opening click', () => {
  const previous = { window: globalThis.window, document: globalThis.document, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const frames = new Map();
  let frameId = 0, opened = 0, saved = 0;
  const classes = { add() {}, remove() {}, toggle() {} };
  const icon = Object.assign(new EventTarget(), { classList: classes });
  const state = { id: 'file', el: icon, left: 20, top: 20 };
  globalThis.document = { body: { classList: classes } };
  globalThis.window = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
  });
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const pointer = (type, x) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: 20 });
    icon.dispatchEvent(event);
  };
  try {
    const interaction = createDesktopIconInteraction({
      iconStateById: new Map([['file', state]]), getIconMetrics: () => ({ width: 50, height: 50 }),
      getDesktopBounds: () => ({ left: 0, top: 0, right: 500, bottom: 500 }),
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      clampIconPosition: point => point, applyIconPosition: (target, point) => Object.assign(target, point),
      resolveIconCollisions() {}, saveIconPositions() { saved++; }, openWindow() { opened++; },
    });
    interaction.bindDesktopIcon(icon, 'file');
    pointer('pointerdown', 20);
    pointer('pointermove', 40);
    pointer('pointermove', 20);
    pointer('pointerup', 20);
    assert.equal(opened, 0);
    assert.equal(saved, 1);
    assert.equal(state.left, 20);
    assert.equal(frames.size, 0);
    pointer('pointerdown', 20);
    pointer('pointerup', 20);
    assert.equal(opened, 1);
    interaction.dispose();
  } finally { Object.assign(globalThis, previous); }
});
