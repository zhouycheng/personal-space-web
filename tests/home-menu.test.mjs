import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomeMenu } from '../src/presentation/ui/studio/homeMenu.ts';

test('signature toggles only the desktop menu, preserving preference across routes and mobile resize', () => {
  const original = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  const media = Object.assign(new EventTarget(), { matches: false });
  const attrs = {};
  const menu = { dataset: {}, inert: true };
  const toggle = Object.assign(new EventTarget(), { setAttribute: (key, value) => { attrs[key] = value; } });
  const explore = { focus: () => { globalThis.document.activeElement = explore; } };
  const studio = { querySelector: selector => ({ '[data-home-menu]': menu, '[data-studio-menu-toggle]': toggle, '[data-studio-explore]': explore })[selector] };
  const events = new AbortController();
  Object.assign(globalThis, { document: { activeElement: toggle }, matchMedia: () => media });
  try {
    const controller = createHomeMenu(studio, events.signal);
    controller.setAvailable(true);
    assert.equal(menu.inert, false);
    toggle.dispatchEvent(new Event('click'));
    assert.equal(menu.inert, true); assert.equal(attrs['aria-expanded'], 'false');
    controller.setAvailable(false); controller.setAvailable(true);
    assert.equal(menu.inert, true);
    media.matches = true; media.dispatchEvent(new Event('change'));
    assert.equal(menu.inert, false); assert.equal(document.activeElement, explore);
    toggle.dispatchEvent(new Event('click'));
    assert.equal(menu.dataset.userHidden, 'true');
    media.matches = false; media.dispatchEvent(new Event('change'));
    assert.equal(menu.inert, true);
    toggle.dispatchEvent(new Event('click'));
    assert.equal(menu.inert, false); assert.equal(attrs['aria-expanded'], 'true');
    controller.setAvailable(false);
    toggle.dispatchEvent(new Event('click'));
    assert.equal(menu.dataset.userHidden, 'false'); assert.equal(menu.inert, true);
    events.abort();
    controller.setAvailable(true); toggle.dispatchEvent(new Event('click'));
    assert.equal(menu.inert, false);
  } finally { events.abort(); Object.assign(globalThis, original); }
});
