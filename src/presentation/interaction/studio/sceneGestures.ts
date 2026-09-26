import * as THREE from "three";
import type { StudioAction } from "../../../contracts/studio";
import { createStudioPicker } from "./pickObject";
import { createStudioHover } from "./sceneHover";
import type { createStudioBounds } from "./sceneBounds";

type GestureOptions = {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  room: THREE.Group;
  mount: HTMLElement;
  tooltip: HTMLElement;
  signal: AbortSignal;
  bounds: ReturnType<typeof createStudioBounds>;
  canInteract: () => boolean;
  canPickJournal: () => boolean;
  onWheel: (deltaY: number, deltaMode: number, viewportHeight: number) => void;
  orbit: (dx: number, dy: number) => void;
  onAction: (action: StudioAction) => void;
  requestDraw: () => void;
  requestInputFrame: () => void;
};

export function createStudioGestureController(options: GestureOptions) {
  const { canvas, camera, room, mount, tooltip, signal, bounds, canInteract, canPickJournal,
    onWheel, orbit, onAction, requestDraw, requestInputFrame } = options;
  const pick = createStudioPicker(canvas, camera, room, canPickJournal, bounds.canvas);
  const hover = createStudioHover({ canvas, mount, tooltip, signal, bounds: bounds.mount, requestDraw });
  const clearHover = hover.clear;
  let pointerEnabled = true;
  let down: { pointerId: number; target: THREE.Group | undefined; x: number; y: number; lastX: number; lastY: number; moved: boolean } | undefined;
  let pendingMove: PointerEvent | undefined;

  function discardMove() { pendingMove = undefined; }
  function flushMove() {
    const latest = pendingMove; pendingMove = undefined;
    if (latest) processMove(latest);
  }

  function reset() {
    discardMove();
    const pointerId = down?.pointerId;
    down = undefined;
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    clearHover();
  }

  canvas.addEventListener("wheel", event => {
    if (!pointerEnabled || !canInteract() || event.ctrlKey || event.metaKey || !event.deltaY) return;
    if (down) down.moved = true;
    event.preventDefault();
    onWheel(event.deltaY, event.deltaMode, bounds.mount().height);
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (!pointerEnabled || !canInteract() || event.button !== 0 || down) return;
    discardMove(); bounds.invalidate();
    clearHover();
    hover.highlight(pick(event));
    down = { pointerId: event.pointerId, target: hover.target, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }, { signal });

  function processMove(event: PointerEvent) {
    if (!pointerEnabled || !canInteract()) return;
    if (down) {
      if (down.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
      if (down.moved) {
        orbit(event.clientX - down.lastX, event.clientY - down.lastY);
        down.lastX = event.clientX;
        down.lastY = event.clientY;
      }
      return;
    }
    hover.show(pick(event), event.clientX, event.clientY);
  }
  canvas.addEventListener("pointermove", event => {
    if (!pointerEnabled || !canInteract() || (down && down.pointerId !== event.pointerId)) return;
    // Preserve gesture intent even when a pointer crosses the threshold and
    // returns to its origin before the next frame consumes its latest position.
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
    pendingMove = event;
    requestInputFrame();
  }, { signal });

  canvas.addEventListener("pointerup", event => {
    if (down?.pointerId !== event.pointerId) return;
    // The release coordinates are the final gesture sample, even before RAF.
    discardMove(); processMove(event);
    const target = down.target;
    const click = pointerEnabled && canInteract() && !down.moved && Math.hypot(event.clientX-down.x,event.clientY-down.y) <= 6;
    down = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") clearHover();
    if (click) {
      const hit = pick(event);
      if (hit === target && hit?.userData.action) { clearHover(); onAction(hit.userData.action); }
    }
  }, { signal });
  canvas.addEventListener("pointercancel", reset, { signal });
  canvas.addEventListener("lostpointercapture", event => { if (down?.pointerId === event.pointerId) reset(); }, { signal });
  window.addEventListener("blur", reset, { signal });
  canvas.addEventListener("pointerleave", () => { if (!down) discardMove(); clearHover(); }, { signal });
  signal.addEventListener("abort", reset, { once: true });

  return {
    clearHover,
    flushMove,
    reset,
    setPointerEnabled(value: boolean) { pointerEnabled = value; if (!value) reset(); },
  };
}
