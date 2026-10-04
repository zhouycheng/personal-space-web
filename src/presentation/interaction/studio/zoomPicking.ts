import * as THREE from 'three';

/** Spatial rejection for dense, batched meshes. Rendering geometry is never changed.
 * Each view shares the original attributes and indices, but tests a short face range.
 * Native raycasting still determines the exact hit, including material sidedness.
 */
export function createZoomPicker(candidates: readonly THREE.Object3D[]) {
  const views = new Map<THREE.BufferGeometry, THREE.BufferGeometry[]>();
  const versions = new Map<THREE.BufferGeometry, {position:number;index:number;start:number;count:number}>();
  const proxy = new THREE.Mesh();
  const inverse = new THREE.Matrix4(), localRay = new THREE.Ray();
  const vertex = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  for (const object of candidates) {
    if (!(object instanceof THREE.Mesh) || object.raycast !== THREE.Mesh.prototype.raycast || object.morphTargetInfluences) continue;
    const source = object.geometry, position = source.attributes.position;
    const count = source.index?.count ?? position.count;
    if (count < 12288 || views.has(source) || position.usage !== THREE.StaticDrawUsage) continue;
    const chunks: THREE.BufferGeometry[] = [];
    const start = source.drawRange.start, end = Math.min(count, start + source.drawRange.count);
    for (let first = start; first < end; first += 768) {
      const last = Math.min(end, first + 768);
      const view = new THREE.BufferGeometry();
      view.attributes = source.attributes;
      view.index = source.index;
      view.groups = source.groups;
      view.setDrawRange(first, last - first);
      view.boundingBox = new THREE.Box3();
      for (let i = first; i < last; i++) {
        vertex.fromBufferAttribute(position, source.index ? source.index.getX(i) : i);
        view.boundingBox.expandByPoint(vertex);
      }
      view.boundingSphere = view.boundingBox.getBoundingSphere(new THREE.Sphere());
      chunks.push(view);
    }
    views.set(source, chunks);
    versions.set(source,{position:position.version,index:source.index?.version??0,start:source.drawRange.start,count:source.drawRange.count});
  }
  return {
    intersect(ray: THREE.Raycaster) {
      hits.length = 0;
      for (const object of candidates) {
        let visible = true;
        for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
          if (!parent.visible) { visible = false; break; }
        }
        if (!visible || !object.layers.test(ray.layers)) continue;
        const source = object instanceof THREE.Mesh ? object.geometry : undefined;
        const version = source ? versions.get(source) : undefined;
        const unchanged = source&&version&&source.attributes.position.version===version.position&&(source.index?.version??0)===version.index&&source.drawRange.start===version.start&&source.drawRange.count===version.count;
        const chunks = unchanged&&object.raycast===THREE.Mesh.prototype.raycast ? views.get(source) : undefined;
        if (!chunks || !(object instanceof THREE.Mesh)) { object.raycast(ray, hits); continue; }
        inverse.copy(object.matrixWorld).invert();
        localRay.copy(ray.ray).applyMatrix4(inverse);
        proxy.matrixWorld.copy(object.matrixWorld);
        proxy.material = object.material;
        for (const geometry of chunks) {
          if (!localRay.intersectsBox(geometry.boundingBox!)) continue;
          proxy.geometry = geometry;
          const first = hits.length;
          proxy.raycast(ray, hits);
          for (let i = first; i < hits.length; i++) hits[i].object = object;
        }
      }
      let nearest: THREE.Intersection | undefined;
      for (const hit of hits) if (!nearest || hit.distance < nearest.distance) nearest = hit;
      return nearest;
    },
    dispose() { views.clear(); versions.clear(); hits.length = 0; },
  };
}
