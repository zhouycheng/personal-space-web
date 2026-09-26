import test from 'node:test';
import assert from 'node:assert/strict';
import { disposeSafely } from '../src/infrastructure/client/dispose.ts';
import * as THREE from 'three';
import { createJournalBookGeometry } from '../src/presentation/scene/journal/journalBookGeometry.ts';

test('texture and renderer disposal failures do not skip bitmaps, remaining resources or DOM cleanup', () => {
  const calls = [], failures = [], textureFailure = new Error('texture'), rendererFailure = new Error('renderer');
  disposeSafely([
    () => { calls.push('texture'); throw textureFailure; },
    () => calls.push('bitmap'),
    () => { calls.push('renderer'); throw rendererFailure; },
    () => calls.push('context'),
    () => calls.push('canvas'),
  ], error => failures.push(error));
  assert.deepEqual(calls, ['texture', 'bitmap', 'renderer', 'context', 'canvas']);
  assert.deepEqual(failures, [textureFailure, rendererFailure]);
});

test('cleanup preserves the original initialization error even if diagnostic reporting also fails', () => {
  const original = new Error('initialization failed'), calls = [];
  function construct() {
    try { throw original; }
    catch (error) {
      disposeSafely([() => { throw new Error('dispose failed'); }, () => calls.push('released')], () => { throw new Error('logger failed'); });
      throw error;
    }
  }
  assert.throws(construct, error => error === original);
  assert.deepEqual(calls, ['released']);
});
test('failed book construction releases created objects and removes only its own scene root', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const original = THREE.Material.prototype.dispose;
  let released = 0;
  const scene = new THREE.Scene(), existing = new THREE.Group(); scene.add(existing);
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } });
    THREE.Material.prototype.dispose = function () { released++; return Reflect.apply(original, this, []); };
    assert.throws(() => createJournalBookGeometry(scene), TypeError);
    assert.ok(released > 0);
    assert.deepEqual(scene.children, [existing]);
  } finally {
    THREE.Material.prototype.dispose = original;
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document;
  }
});
