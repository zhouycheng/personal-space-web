import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';

test('immutable shapes share GPU geometry within one scene and remain isolated across scenes', () => {
  const create = () => {
    const room = new THREE.Group(), materials = new Set(), geometries = new Set(), textures = new Set();
    return { room, materials, geometries, primitives: createStudioPrimitives({}, room, materials, geometries, textures) };
  };
  const a = create(), b = create();
  const first = a.primitives.box(a.room, [1, 2, 3], [0, 0, 0]);
  const second = a.primitives.box(a.room, [1, 2, 3], [2, 0, 0]);
  assert.notEqual(first, second);
  assert.equal(first.geometry, second.geometry);
  second.rotation.y = 1;
  assert.equal(first.rotation.y, 0);
  assert.notEqual(first.geometry, a.primitives.box(a.room, [1, 2, 4], [0, 0, 0]).geometry);
  assert.notEqual(first.geometry, b.primitives.box(b.room, [1, 2, 3], [0, 0, 0]).geometry);
  const cylinders = [0, 1].map(x => a.primitives.cylinder(a.room, .2, 1, [x, 0, 0]));
  assert.equal(cylinders[0].geometry, cylinders[1].geometry);
  const rounded = [0, 1].map(x => a.primitives.rounded(a.room, [1, 2, 3], [x, 0, 0], a.primitives.wood, .1));
  assert.equal(rounded[0].geometry, rounded[1].geometry);
  let releases = 0;
  first.geometry.addEventListener('dispose', () => releases++);
  for (const instance of [a, b]) {
    instance.geometries.forEach(geometry => geometry.dispose());
    instance.materials.forEach(material => material.dispose());
  }
  assert.equal(releases, 1);
});
