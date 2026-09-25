import * as THREE from "three";
import { ACTION_LABELS, type StudioAction } from "../../../contracts/studio";
import { createStudioPicker } from "./pickObject";

type GestureOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  room: THREE.Group;
  mount: HTMLElement;
  tooltip: HTMLElement;
  signal: AbortSignal;
  canInteract: () => boolean;
  canPickJournal: () => boolean;
  onWheel: (deltaY: number, deltaMode: number, viewportHeight: number) => void;
  orbit: (dx: number, dy: number) => void;
  onAction: (action: StudioAction) => void;
  requestDraw: () => void;
};

export function createStudioGestureController(options: GestureOptions) {
  const { canvas, camera, room, mount, tooltip, signal, canInteract, canPickJournal,
    onWheel, orbit, onAction, requestDraw } = options;
  const pick = createStudioPicker(canvas, camera, room, canPickJournal);
  const highlighted: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; glow: THREE.Material | THREE.Material[] }[] = [];
  let hovering: THREE.Group | undefined;
  let pointerEnabled = true;
  let down: { pointerId: number; x: number; y: number; lastX: number; lastY: number; moved: boolean } | undefined;

  function clearHover() {
    for (const item of highlighted) {
      item.mesh.material = item.original;
      for (const material of [item.glow].flat()) material.dispose();
    }
    if (highlighted.length) requestDraw();
    highlighted.length = 0;
    hovering = undefined;
    tooltip.hidden = true;
    canvas.style.cursor = "grab";
  }

  function highlight(group: THREE.Group | undefined) {
    hovering = group;
    group?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.hitProxy) return;
      const original = object.material;
      const glowMaterial = (material: THREE.Material) => {
        const glow = material.clone();
        if (glow instanceof THREE.MeshStandardMaterial) {
          glow.emissive.setHex(0xe9f1ff);
          glow.emissiveIntensity = 0.12;
        }
        return glow;
      };
      const glow = Array.isArray(original) ? original.map(glowMaterial) : glowMaterial(original);
      highlighted.push({ mesh: object, original, glow });
      object.material = glow;
    });
    requestDraw();
  }

  function reset() {
    if (down && canvas.hasPointerCapture(down.pointerId)) canvas.releasePointerCapture(down.pointerId);
    down = undefined;
    clearHover();
  }

  canvas.addEventListener("wheel", event => {
    if (!pointerEnabled || !canInteract() || event.ctrlKey || event.metaKey || !event.deltaY) return;
    if (down) down.moved = true;
    event.preventDefault();
    onWheel(event.deltaY, event.deltaMode, mount.clientHeight);
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (!pointerEnabled || !canInteract() || event.button !== 0) return;
    clearHover();
    highlight(pick(event));
    down = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }, { signal });

  canvas.addEventListener("pointermove", event => {
    if (!pointerEnabled || !canInteract()) return;
    if (down) {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
      if (down.moved) {
        orbit(event.clientX - down.lastX, event.clientY - down.lastY);
        down.lastX = event.clientX;
        down.lastY = event.clientY;
      }
      return;
    }
    const hit = pick(event);
    if (hit !== hovering) { clearHover(); highlight(hit); }
    if (hovering) {
      tooltip.textContent = hovering.userData.label ?? ACTION_LABELS[hovering.userData.action as StudioAction];
      tooltip.hidden = false;
      const rect = mount.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(rect.width - tooltip.offsetWidth - 8, event.clientX - rect.left + 16))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 34)}px`;
      canvas.style.cursor = hovering.userData.action ? "pointer" : "help";
    }
  }, { signal });

  canvas.addEventListener("pointerup", event => {
    const click = pointerEnabled && canInteract() && down && !down.moved;
    down = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") clearHover();
    if (click) {
      const hit = pick(event);
      if (hit?.userData.action) { clearHover(); onAction(hit.userData.action); }
    }
  }, { signal });
  canvas.addEventListener("pointercancel", reset, { signal });
  canvas.addEventListener("pointerleave", clearHover, { signal });

  return {
    clearHover,
    reset,
    setPointerEnabled(value: boolean) { pointerEnabled = value; if (!value) reset(); },
  };
}
