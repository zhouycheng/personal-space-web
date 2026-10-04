import * as THREE from 'three';
import { mergeIndexed } from './indexedGeometry.ts';

/** Only siblings move and pick as one unit. Named/referenced meshes keep identity. */
export function batchStaticChildren(root: THREE.Object3D, geometries: Set<THREE.BufferGeometry>,
  preserved: ReadonlySet<THREE.Object3D> = new Set()) {
  for (const child of [...root.children]) if (!(child instanceof THREE.Mesh)) {
    batchStaticChildren(child, geometries, preserved);
  }
  const batches = new Map<string, THREE.Mesh[]>();
  for (const child of root.children) {
    if (!(child instanceof THREE.Mesh) || child.children.length || child.name || preserved.has(child) || Object.keys(child.userData).length ||
      !child.visible || Array.isArray(child.material) || child.material.transparent || child.customDepthMaterial ||
      child.customDistanceMaterial || child.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
      child.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || child.raycast !== THREE.Mesh.prototype.raycast ||
      Object.keys(child.geometry.morphAttributes).length || child.geometry.drawRange.start !== 0 ||
      child.geometry.drawRange.count !== Infinity || Object.values(child.geometry.attributes).some(a => a instanceof THREE.BufferAttribute && a.usage !== THREE.StaticDrawUsage)) continue;
    child.updateMatrix();
    if (child.matrix.determinant() <= 0) continue;
    const attributes = Object.keys(child.geometry.attributes).map(name => { const value=child.geometry.getAttribute(name);return `${name}:${value.itemSize}:${value.normalized}`; }).sort().join(',');
    const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.layers.mask}:${child.renderOrder}:${child.frustumCulled}:${attributes}`;
    const batch = batches.get(key) ?? []; batch.push(child); batches.set(key, batch);
  }
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const geometry = mergeIndexed(objects);
    if (!geometry) continue;
    const first = objects[0], mesh = new THREE.Mesh(geometry, first.material);
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    mesh.layers.mask = first.layers.mask; mesh.renderOrder = first.renderOrder; mesh.frustumCulled = first.frustumCulled;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometries.add(geometry);
    objects.forEach(object => object.removeFromParent()); root.add(mesh);
  }
}
