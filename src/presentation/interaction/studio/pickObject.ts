import * as THREE from "three";
import { createZoomPicker } from './zoomPicking.ts';

/** Convert a canvas pointer into the first actionable room object. */
export function createStudioPicker(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  room: THREE.Group,
  acceptProxy: () => boolean,
  bounds = () => canvas.getBoundingClientRect(),
  extraRoots: readonly THREE.Object3D[] = [],
) {
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const candidates: THREE.Object3D[] = [];
  // Keep every raycastable object, including non-actionable occluders.
  for (const root of [room, ...extraRoots]) root.traverse(object => {
    if (object.raycast !== THREE.Object3D.prototype.raycast && !(object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial)) candidates.push(object);
  });
  const picker = createZoomPicker(candidates, object => !object.userData.hitProxy || acceptProxy());

  function pick(event: PointerEvent): THREE.Group | undefined {
    const rect = bounds();
    if (!rect.width || !rect.height) return undefined;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    room.updateWorldMatrix(true, true);
    extraRoots.forEach(root => root.updateWorldMatrix(true, true));
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    const hit = picker.intersect(ray);
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.action && !object.userData.label) object = object.parent;
    if (object?.userData.action === "diary" && !acceptProxy()) return undefined;
    return (object ?? undefined) as THREE.Group | undefined;
  }
  return Object.assign(pick, { dispose: picker.dispose });
}
