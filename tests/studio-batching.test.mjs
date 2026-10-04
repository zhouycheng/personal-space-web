import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticChildren } from '../src/presentation/scene/studio/staticBatches.ts';
import { createIslandLeisure } from '../src/presentation/scene/studio/islandLeisure.ts';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { roomCameraStep } from '../src/animation/studio/studioMotion.ts';

test('batching retains shadow flags, world shape, picking ownership and independently moving groups', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshStandardMaterial();
  const owned = new Set([geometry]);
  const drawer = new THREE.Group(); drawer.userData.action = 'drawer-top'; root.add(drawer);
  for (const parent of [root, drawer]) for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * 2, 0, 0); mesh.castShadow = i < 2;
    parent.add(mesh);
  }
  const before = new THREE.Box3().setFromObject(root);
  batchStaticChildren(root, owned);
  assert.equal(root.children.filter(o => o.isMesh).length, 2);
  assert.equal(drawer.children.length, 2);
  assert.ok(new THREE.Box3().setFromObject(root).equals(before));
  assert.deepEqual(drawer.children.map(o => o.castShadow), [true, false]);
  drawer.position.y = 2; root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 5), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(root, true)[0].object.parent, drawer);
  for (const item of owned) item.dispose(); material.dispose();
});

test('referenced surfaces and shader-local geometry keep their object identities', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const meshes = Array.from({ length: 3 }, () => new THREE.Mesh(geometry, material)); root.add(...meshes);
  batchStaticChildren(root, new Set(), new Set([meshes[0]]));
  assert.ok(root.children.includes(meshes[0])); assert.equal(root.children.length, 2);
  const custom = new THREE.MeshStandardMaterial(); custom.onBeforeCompile = () => {};
  const local = [new THREE.Mesh(geometry, custom), new THREE.Mesh(geometry, custom)]; root.add(...local);
  batchStaticChildren(root, new Set());
  assert.ok(local.every(mesh => mesh.parent === root));
});

test('leisure batching leaves wool fibres out of the shadow pass', () => {
  const materials = new Set(), geometries = new Set(), textures = new Set(), root = new THREE.Group();
  const p = createStudioPrimitives({}, root, materials, geometries, textures);
  const { group } = createIslandLeisure(p, materials, textures);
  const wool = group.children.filter(mesh => mesh.isMesh && mesh.material.customProgramCacheKey() === 'wool-loop-pile-v1');
  const pile = wool.filter(mesh => !mesh.castShadow);
  assert.equal(pile.length, 1); assert.ok(pile[0].geometry.attributes.position.count > 120000);
  assert.ok(wool.some(mesh => mesh.castShadow), 'rug body and fringe retain their own shadow policy');
  for (const resource of [...materials, ...geometries, ...textures]) resource.dispose();
});

test('camera retains damping with a shorter response at 60 and 120 Hz', () => {
  for (const hz of [60, 120]) {
    const state = { velocity: 0 }; let value = 0, elapsed = 0;
    while (value < .9) { const next = roomCameraStep(value, 1, 1000 / hz, state); assert.ok(next > value && next < 1); value = next; elapsed += 1000 / hz; }
    assert.ok(elapsed >= 83 && elapsed <= 101);
    const before = value;
    value = roomCameraStep(value, 0, 1000 / hz, state);
    assert.ok(Math.abs(value - before) < .2, 'reversal remains continuous');
  }
});
