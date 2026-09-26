import * as THREE from "three";

/** Convert a canvas pointer into the first actionable room object. */
export function createStudioPicker(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  room: THREE.Group,
  acceptProxy: () => boolean,
  bounds = () => canvas.getBoundingClientRect(),
) {
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const candidates: THREE.Object3D[] = [];
  // Keep every raycastable object, including non-actionable occluders.
  room.traverse(object => { if (object.raycast !== THREE.Object3D.prototype.raycast) candidates.push(object); });

  return (event: PointerEvent): THREE.Group | undefined => {
    const rect = bounds();
    if (!rect.width || !rect.height) return undefined;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    room.updateWorldMatrix(true, true);
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(candidates, false).find(({ object }) => {
      if (object.userData.hitProxy && !acceptProxy()) return false;
      let ancestor: THREE.Object3D | null = object;
      while (ancestor) { if (!ancestor.visible) return false; ancestor = ancestor.parent; }
      return true;
    });
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.action && !object.userData.label) object = object.parent;
    if (object?.userData.action === "diary" && !acceptProxy()) return undefined;
    return (object ?? undefined) as THREE.Group | undefined;
  };
}
