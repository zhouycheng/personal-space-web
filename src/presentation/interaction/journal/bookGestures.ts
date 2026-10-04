import * as THREE from "three";
import type { JournalBookPhase } from "../../../contracts/journal";
import { clamp } from "../../../animation/journal/inspection";

type Hit = { x: number; y: number; left: boolean; cover: boolean; region: boolean };
export type PageTurnGrip = { u: number; v: number; skew: number };
type Options = {
  canvas: HTMLCanvasElement; enabled(): boolean; phase(): JournalBookPhase; zoom(): number; single(): boolean;
  canDragTurn?():boolean;
  hit(event: PointerEvent): Hit | undefined; begin(direction: 1 | -1, grip: PageTurnGrip): boolean;
  deform(value: number, grip: PageTurnGrip): void; progress(): number; finish(commit: boolean, velocity: number): void;
  rotate(dx: number, dy: number): void; pan(dx: number, dy: number): void;
  setZoom(value: number): void; click(event: PointerEvent): void; interrupt(): void;
};

/** Pointer identity and capture live here; this layer never selects an article or writes history. */
export function createBookGestures(options: Options) {
  const { canvas } = options, events = new AbortController();
  const pointers = new Map<number, THREE.Vector2>();
  let drag: { id: number; x: number; y: number; lastX: number; lastY: number; lastAt: number; direction: 1 | -1 | 0;
    kind: 'turn' | 'rotate' | 'pan'; moved: boolean; grip: PageTurnGrip; velocity: number } | undefined;
  let pinch: { distance: number; zoom: number; center: THREE.Vector2 } | undefined;
  function release() {
    const ids = [...pointers.keys()];
    pointers.clear(); drag = undefined; pinch = undefined;
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function cancel() {
    const turning = drag?.kind === 'turn', velocity = turning ? drag!.velocity : 0;
    release(); if (turning) options.finish(false, velocity);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!options.enabled() || event.button !== 0) return;
    if (pointers.size) {
      pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId); options.interrupt(); drag = undefined;
      const [a, b] = [...pointers.values()];
      pinch = { distance: a.distanceTo(b), zoom: options.zoom(), center: a.clone().add(b).multiplyScalar(.5) };
      event.preventDefault(); return;
    }
    const hit = options.hit(event); if (!hit) return;
    const { x, y } = hit;
    const direction = options.canDragTurn?.()!==false && options.phase() === 'reading' && !hit.region && (y < .2 || y > .8)
      ? (options.single() ? (x > .84 ? 1 : x < .16 ? -1 : 0) : (!hit.left && x > .84 ? 1 : hit.left && x < .16 ? -1 : 0)) : 0;
    const grip = { u: THREE.MathUtils.clamp(direction === -1 ? 1 - x : x, 0, 1), v: y * 2 - 1, skew: 0 };
    if (direction && !options.begin(direction, grip)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
      lastAt: event.timeStamp, direction, kind: direction ? 'turn' : options.zoom() > 1.05 || event.shiftKey ? 'pan' : 'rotate', moved: false,
      grip, velocity: 0 };
    pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    canvas.setPointerCapture(event.pointerId); event.preventDefault();
  }, { signal: events.signal });
  function move(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      options.setZoom(pinch.zoom * a.distanceTo(b) / Math.max(1, pinch.distance));
      const center = a.clone().add(b).multiplyScalar(.5);
      options.pan(center.x - pinch.center.x, center.y - pinch.center.y);
      pinch.center.copy(center); return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true;
    const dx = event.clientX - drag.lastX, dy = event.clientY - drag.lastY;
    const now = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
    const seconds = Math.max(.001, (now - drag.lastAt) / 1000);
    drag.lastX = event.clientX; drag.lastY = event.clientY;
    drag.lastAt = now;
    if (!drag.moved) return;
    if (drag.kind === 'turn') {
      const pageWidth = Math.max(1, canvas.clientWidth / (options.single() ? 1 : 2));
      const distance = Math.max(150, pageWidth * .82);
      const horizontalSweep = -(event.clientX - drag.x) * drag.direction;
      const verticalSweep = Math.max(0, -drag.grip.v * (event.clientY - drag.y));
      const amount = clamp((horizontalSweep + verticalSweep * .35) / distance, 0, 1);
      const rawVelocity = clamp((-dx * drag.direction + Math.max(0, -drag.grip.v * dy) * .35) / distance / seconds, -3, 3);
      drag.velocity = THREE.MathUtils.lerp(drag.velocity, rawVelocity, 1 - Math.exp(-seconds * 16));
      const horizontalPull = Math.max(.12, -(event.clientX - drag.x) * drag.direction / pageWidth);
      const verticalPull = -2 * (event.clientY - drag.y) / Math.max(1, canvas.clientHeight);
      options.deform(amount, {
        u: clamp(drag.grip.u + drag.direction * (event.clientX - drag.x) / pageWidth, 0, 1),
        v: clamp(drag.grip.v + verticalPull, -1, 1),
        skew: clamp(verticalPull / horizontalPull, -1.25, 1.25),
      });
    } else if (drag.kind === 'pan') options.pan(dx, dy);
    else options.rotate(dx, dy);
  }
  canvas.addEventListener('pointermove', move, { signal: events.signal });
  canvas.addEventListener('pointerup', event => {
    if (!pointers.has(event.pointerId)) return;
    move(event);
    if (pinch) { release(); return; }
    if (!drag || drag.id !== event.pointerId) return;
    const gesture = drag; release();
    if (gesture.kind === 'turn') {
      const amount = options.progress();
      options.finish(!gesture.moved || amount > .35 || (amount > .12 && gesture.velocity > .9), gesture.velocity);
    } else if (!gesture.moved) options.click(event);
  }, { signal: events.signal });
  canvas.addEventListener('pointercancel', cancel, { signal: events.signal });
  canvas.addEventListener('lostpointercapture', event => { if (pointers.has(event.pointerId)) cancel(); }, { signal: events.signal });
  window.addEventListener('blur', cancel, { signal: events.signal });
  canvas.addEventListener('wheel', event => {
    if (!options.enabled()) return;
    event.preventDefault(); options.setZoom(options.zoom() * Math.exp(-event.deltaY * .001));
  }, { signal: events.signal, passive: false });
  return { release, cancel, dispose() { release(); events.abort(); } };
}
