import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Preserve the exact triangle/attribute stream, including seams and hard normals. */
export function indexedCopy(source: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
  const geometry = source.clone();
  if (!geometry.index) {
    const count = geometry.getAttribute('position').count;
    const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  if (matrix) geometry.applyMatrix4(matrix);
  return geometry;
}

/** Caller retains source ownership; temporary transformed buffers are released here. */
export function mergeIndexed(objects: readonly { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]) {
  const pieces = objects.map(object => indexedCopy(object.geometry, object.matrix));
  try { return mergeGeometries(pieces); }
  finally { pieces.forEach(piece => piece.dispose()); }
}
