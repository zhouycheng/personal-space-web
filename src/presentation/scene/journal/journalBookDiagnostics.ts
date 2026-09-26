import * as THREE from "three";

/** Read-only projections let browser tests send real pointer input to model surfaces. */
export function journalPageTargets(camera: THREE.Camera, canvas: HTMLCanvasElement, pages: { index: number; mesh: THREE.Mesh; left: boolean }[]) {
  const bounds = canvas.getBoundingClientRect();
  return pages.map(({ index, mesh, left }) => {
    mesh.updateWorldMatrix(true, false);
    function point(u: number, v: number) {
      const geometry = mesh.geometry as THREE.PlaneGeometry;
      const columns = geometry.parameters.widthSegments;
      const positions = geometry.getAttribute("position");
      const column = Math.min(columns, Math.max(0, Math.round(u * columns)));
      const local = new THREE.Vector3((u - .5) * geometry.parameters.width, (.5 - v) * geometry.parameters.height, positions.getZ(column));
      local.applyMatrix4(mesh.matrixWorld).project(camera);
      return { x: bounds.left + (local.x + 1) * bounds.width / 2, y: bounds.top + (1 - local.y) * bounds.height / 2 };
    }
    return { page: index, left, center: point(.5, .5), edge: point(left ? .06 : .94, .92) };
  });
}
