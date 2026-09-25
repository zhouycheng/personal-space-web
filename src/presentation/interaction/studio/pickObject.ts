import * as THREE from "three";

/** Convert a canvas pointer into the first actionable room object. */
export function createStudioPicker(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  room: THREE.Group,
  acceptProxy: () => boolean,
) {
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return (event: PointerEvent): THREE.Group | undefined => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(room.children, true).find(({ object }) =>
      !object.userData.hitProxy || acceptProxy(),
    );
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.action && !object.userData.label) object = object.parent;
    return (object ?? undefined) as THREE.Group | undefined;
  };
}
