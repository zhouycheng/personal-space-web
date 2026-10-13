import assert from 'node:assert/strict';
import test from 'node:test';
import { getShortcutSystem, matchesShortcut } from '../src/justin-kit/runtime/shortcuts.ts';

function environment(mac = false) {
  let modal = null;
  const view = Object.assign(new EventTarget(), { navigator: { userAgent: mac ? 'Macintosh' : 'Windows' } });
  const document = Object.assign(new EventTarget(), {
    defaultView: view, hidden: false, URL: 'https://justin.test/page', location: { origin: 'https://justin.test' },
    querySelector: () => modal,
  });
  function owner(parent = null, tag = 'DIV') {
    return {
      ownerDocument: document, nodeType: 1, tagName: tag, parent, isConnected: true, inert: false,
      matches: () => false,
      contains(target) { for (let next = target; next; next = next.parent) if (next === this) return true; return false; },
      closest(selector) {
        if (selector === '[hidden],[inert]') { for (let next = this; next; next = next.parent) if (next.inert || next.hidden) return next; }
        if (selector.startsWith('input,') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName)) return this;
        if (selector.startsWith('select,') && this.tagName === 'SELECT') return this;
        return null;
      },
    };
  }
  function press(key, target, options = {}) {
    const event = new Event('keydown', { cancelable: true });
    const { timeStamp, ...properties } = options;
    Object.assign(event, { key, ...properties });
    if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    Object.defineProperty(event, 'target', { value: target });
    view.dispatchEvent(event);
    return event;
  }
  return { view, document, owner, press, modal(value) { modal = value; }, system: getShortcutSystem(document) };
}
const command = (id, run, keys = ['Escape']) => ({ id, description: id, keys, run });

test('semantic keys match explicit modifiers on both platforms', () => {
  assert.equal(matchesShortcut({ key: 'k', metaKey: true }, { key: 'k', mod: true }, true), true);
  assert.equal(matchesShortcut({ key: 'k', ctrlKey: true }, { key: 'k', mod: true }, false), true);
  assert.equal(matchesShortcut({ key: 'Escape', ctrlKey: true }, 'Escape', false), false);
  assert.equal(matchesShortcut({ key: ' ', shiftKey: false }, 'Space', false), true);
  for (const shiftKey of [false, true]) assert.equal(matchesShortcut({ key: '+', shiftKey }, { key: '+', shift: 'any' }, false), true);
});

test('double presses require two fresh events within 400ms and keep overlay exits separate', () => {
  const env = environment(), page = env.owner(), dialog = env.owner(page);
  let retreats = 0, closes = 0;
  const home = env.system.createScope({ id: 'home', owner: page });
  const overlay = env.system.createScope({ id: 'modal', owner: dialog, kind: 'modal', active: false });
  home.register({ ...command('retreat', () => retreats++), presses: 2 });
  overlay.register(command('close', () => { closes++; overlay.setActive(false); }));
  assert.equal(env.press('Escape', page, { timeStamp: 0 }).defaultPrevented, true);
  env.press('Escape', page, { timeStamp: 100, repeat: true }); assert.equal(retreats, 0);
  env.press('Escape', page, { timeStamp: 401 }); assert.equal(retreats, 0);
  env.press('Escape', page, { timeStamp: 650 }); assert.equal(retreats, 1);
  env.press('Escape', page, { timeStamp: 700 });
  overlay.setActive(true); env.press('Escape', dialog, { timeStamp: 750 }); assert.equal(closes, 1);
  env.press('Escape', page, { timeStamp: 800 }); assert.equal(retreats, 1);
  env.press('Escape', page, { timeStamp: 900 }); assert.equal(retreats, 2);
  overlay.dispose(); home.dispose();
});

test('double press state resets on unrelated input, suspension and command lifetime changes', () => {
  const env = environment(), page = env.owner();
  let calls = 0, now = 0;
  const scope = env.system.createScope({ id: 'home', owner: page });
  const register = () => scope.register({ ...command('retreat', () => calls++), presses: 2 });
  let unregister = register();
  const escape = options => env.press('Escape', page, { timeStamp: now += 10, ...options });
  for (const reset of [
    () => env.press('Enter', page),
    () => escape({ isComposing: true }),
    () => env.view.dispatchEvent(new Event('blur')),
    () => { env.document.hidden = true; env.document.dispatchEvent(new Event('visibilitychange')); env.document.hidden = false; },
    () => { env.view.dispatchEvent(new Event('pagehide')); env.view.dispatchEvent(new Event('pageshow')); },
    () => { unregister(); unregister = register(); },
  ]) {
    escape(); reset(); escape(); assert.equal(calls, 0);
    env.view.dispatchEvent(new Event('blur'));
  }
  escape(); escape(); assert.equal(calls, 1); scope.dispose();
});

test('a nested menu, modal and page each consume one separate Escape, including held keys', () => {
  const env = environment(), calls = [];
  const page = env.owner(), dialog = env.owner(page), menu = env.owner(dialog);
  const pageKeys = env.system.createScope({ id: 'page', owner: page });
  const modalKeys = env.system.createScope({ id: 'modal', owner: dialog, kind: 'modal' });
  const menuKeys = env.system.createScope({ id: 'menu', owner: menu, kind: 'overlay' });
  env.modal(dialog);
  pageKeys.register(command('home', () => calls.push('home')));
  modalKeys.register(command('dismiss', () => { calls.push('modal'); modalKeys.setActive(false); env.modal(null); }));
  menuKeys.register(command('dismiss', () => { calls.push('menu'); menuKeys.setActive(false); }));
  env.press('Escape', menu);
  assert.deepEqual(calls, ['menu']);
  assert.equal(env.press('Escape', dialog, { repeat: true }).defaultPrevented, true);
  assert.deepEqual(calls, ['menu']);
  env.press('Escape', dialog);
  assert.deepEqual(calls, ['menu', 'modal']);
  env.press('Escape', page, { repeat: true });
  assert.deepEqual(calls, ['menu', 'modal']);
  env.press('Escape', page);
  assert.deepEqual(calls, ['menu', 'modal', 'home']);
  for (const scope of [pageKeys, modalKeys, menuKeys]) scope.dispose();
});

test('the last activated peer overlay wins, and modal input isolates background shortcuts', () => {
  const env = environment(), calls = [], page = env.owner(), first = env.owner(page), second = env.owner(page);
  const a = env.system.createScope({ id: 'a', owner: first, kind: 'overlay' });
  const b = env.system.createScope({ id: 'b', owner: second, kind: 'overlay' });
  a.register(command('dismiss', () => calls.push('a'))); b.register(command('dismiss', () => calls.push('b')));
  env.press('Escape', page); a.setActive(false); a.setActive(true); env.press('Escape', page);
  assert.deepEqual(calls, ['b', 'a']);
  const modal = env.system.createScope({ id: 'modal', owner: env.owner(page), kind: 'modal' });
  assert.equal(env.press('Escape', page).defaultPrevented, false);
  assert.deepEqual(calls, ['b', 'a']);
  modal.dispose(); a.dispose(); b.dispose();
});

test('editable targets, composition and consumed events are protected, with explicit Escape support', () => {
  const env = environment(), page = env.owner(), input = env.owner(page, 'INPUT'), select = env.owner(page, 'SELECT');
  let calls = 0;
  const scope = env.system.createScope({ id: 'page', owner: page });
  scope.register(command('turn', () => calls++, ['ArrowRight']));
  scope.register({ ...command('exit', () => calls++), allowInEditable: true });
  env.press('ArrowRight', input); env.press('Escape', select); env.press('Escape', input, { isComposing: true });
  env.press('Escape', input, { keyCode: 229 }); env.press('Process', input); env.press('Escape', input, { altKey: true });
  const consumed = new Event('keydown', { cancelable: true }); Object.assign(consumed, { key: 'Escape' }); consumed.preventDefault(); env.view.dispatchEvent(consumed);
  assert.equal(calls, 0);
  env.press('Escape', input); assert.equal(calls, 1);
  scope.dispose();
});

test('documents share listeners, abort and unregister precisely, and suspend across BFCache', () => {
  const env = environment(), page = env.owner(), lifetime = new AbortController();
  assert.equal(env.system, getShortcutSystem(env.document));
  let calls = 0;
  const scope = env.system.createScope({ id: 'page', owner: page, signal: lifetime.signal });
  const unregister = scope.register({ ...command('turn', () => calls++, ['ArrowRight']), repeat: true });
  assert.throws(() => scope.register(command('turn', () => {})), /Duplicate shortcut command/);
  assert.throws(() => env.system.createScope({ id: 'page', owner: page }), /Duplicate shortcut scope/);
  env.press('ArrowRight', page, { repeat: true }); assert.equal(calls, 1);
  env.view.dispatchEvent(new Event('pagehide')); env.press('ArrowRight', page); assert.equal(calls, 1);
  env.view.dispatchEvent(new Event('pageshow')); env.press('ArrowRight', page); assert.equal(calls, 2);
  env.document.hidden = true; env.press('ArrowRight', page); env.document.hidden = false;
  page.inert = true; env.press('ArrowRight', page); page.inert = false;
  page.isConnected = false; env.press('ArrowRight', page); page.isConnected = true;
  assert.equal(calls, 2);
  unregister(); env.press('ArrowRight', page); assert.equal(calls, 2);
  scope.register(command('exit', () => calls++)); lifetime.abort(); env.press('Escape', page); assert.equal(calls, 2);
  const remount = env.system.createScope({ id: 'page', owner: page }); remount.register(command('exit', () => calls++));
  env.press('Escape', page); assert.equal(calls, 3); remount.dispose();
});

test('modifier state follows keyup, blur and visibility changes', () => {
  const env = environment(true), values = [];
  const stop = env.system.observeModifiers(value => values.push(value));
  env.press('Shift', env.owner(), { shiftKey: true, metaKey: true });
  assert.equal(values.at(-1).mod && values.at(-1).shift, true);
  const keyup = new Event('keyup'); Object.assign(keyup, { metaKey: true }); env.view.dispatchEvent(keyup);
  assert.equal(values.at(-1).mod, true); assert.equal(values.at(-1).shift, false);
  env.view.dispatchEvent(new Event('blur')); assert.equal(values.at(-1).mod, false);
  env.press('Meta', env.owner(), { metaKey: true });
  env.document.hidden = true; env.document.dispatchEvent(new Event('visibilitychange')); assert.equal(values.at(-1).mod, false);
  stop();
});

test('a failed overlay action still consumes the event and preserves its parent page', () => {
  const env = environment(), page = env.owner(), overlay = env.owner(page);
  const parent = env.system.createScope({ id: 'page', owner: page }), child = env.system.createScope({ id: 'overlay', owner: overlay, kind: 'overlay' });
  let exits = 0; parent.register(command('home', () => exits++)); child.register(command('dismiss', () => { throw new Error('broken overlay'); }));
  const original = console.error, errors = []; console.error = (...args) => errors.push(args);
  try { assert.equal(env.press('Escape', page).defaultPrevented, true); assert.equal(exits, 0); assert.equal(errors.length, 1); }
  finally { console.error = original; parent.dispose(); child.dispose(); }
});

test('identical modifier callbacks retain independent subscription lifetimes', () => {
  const env = environment(); let calls = 0;
  const listener = () => calls++;
  const first = env.system.observeModifiers(listener), second = env.system.observeModifiers(listener);
  env.press('Shift', env.owner(), { shiftKey: true }); assert.equal(calls, 4);
  first(); env.press('Shift', env.owner()); assert.equal(calls, 5);
  second(); env.press('Shift', env.owner()); assert.equal(calls, 5);
});

test('same-origin frames forward unhandled Escape after all child listeners and release their old document on reload', async () => {
  const dispatched = () => new Promise(resolve => setTimeout(resolve, 0));
  const parent = environment(), child = environment(), next = environment(), page = parent.owner();
  const scope = parent.system.createScope({ id: 'page', owner: page });
  let exits = 0, enabled = true; scope.register({ ...command('home', () => exits++), allowInEditable: true });
  const frame = Object.assign(new EventTarget(), { contentDocument: child.document, isConnected: true, closest: () => null });
  const stop = parent.system.attachFrame(frame, { enabled: () => enabled });
  child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1);
  const consume = event => event.preventDefault(); child.view.addEventListener('keydown', consume);
  child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1);
  child.view.removeEventListener('keydown', consume);
  enabled = false; child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1); enabled = true;
  child.press('Enter', child.owner()); child.press('Escape', child.owner(), { isComposing: true }); await dispatched(); assert.equal(exits, 1);
  const control = child.system.createScope({ id: 'control', owner: child.owner() }); control.register(command('dismiss', () => {}));
  child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1); control.dispose();
  child.modal(child.owner()); child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1); child.modal(null);
  frame.contentDocument = next.document; frame.dispatchEvent(new Event('load'));
  child.press('Escape', child.owner()); await dispatched(); assert.equal(exits, 1); next.press('Escape', next.owner()); await dispatched(); assert.equal(exits, 2);
  next.document.URL = 'https://other.test/frame'; frame.dispatchEvent(new Event('load'));
  next.press('Escape', next.owner()); await dispatched(); assert.equal(exits, 2);
  stop(); scope.dispose();
});
