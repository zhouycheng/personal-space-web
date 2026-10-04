import * as THREE from "three";
import type { StudioAction } from "../../../contracts/studio";
import { createStudioPicker } from "./pickObject.ts";
import { createStudioHover } from "./sceneHover.ts";
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
  onWheel: (deltaY: number, deltaMode: number, viewportHeight: number,x:number,y:number) => void;
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
  const pendingWheels: {delta:number;x:number;y:number;height:number}[] = [];
  const touches=new Map<number,{x:number;y:number}>();
  let pair:{x:number;y:number;distance:number;angle:number}|undefined;
  function touchPair(){
    const [a,b]=[...touches.values()];
    return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y),angle:Math.atan2(b.y-a.y,b.x-a.x)}:undefined;
  }

  function discardMove() { pendingMove = undefined; }
  function flushMove() {
    if(pointerEnabled&&canInteract()) {
      for(const wheel of pendingWheels)onWheel(wheel.delta,0,wheel.height,wheel.x,wheel.y);
    }
    pendingWheels.length=0;
    const latest = pendingMove; pendingMove = undefined;
    if (latest) processMove(latest);
  }

  function reset() {
    discardMove();
    pendingWheels.length=0;
    const pointerId = down?.pointerId;
    const captured=[...touches.keys()];touches.clear();pair=undefined;down = undefined;
    for(const id of captured)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    clearHover();
  }

  canvas.addEventListener("wheel", event => {
    if (!pointerEnabled || !canInteract() || event.ctrlKey || event.metaKey || !event.deltaY) return;
    if (down) down.moved = true;
    event.preventDefault();
    const height=bounds.mount().height;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
    const previous=pendingWheels.at(-1);
    // Merge a continuous wheel direction once per frame; preserve reversals so
    // the existing zoom clamp still responds immediately at either limit.
    if(previous&&Math.sign(previous.delta)===Math.sign(delta)) {
      previous.delta+=delta;previous.x=event.clientX;previous.y=event.clientY;
    } else pendingWheels.push({delta,x:event.clientX,y:event.clientY,height});
    requestInputFrame();
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (!pointerEnabled || !canInteract() || event.button !== 0) return;
    if(event.pointerType==='touch'){
      if(touches.size>=2)return;
      flushMove();touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      canvas.setPointerCapture(event.pointerId);
      if(touches.size===2){pair=touchPair();if(down)down.moved=true;clearHover();return;}
    }else if(down)return;
    discardMove(); bounds.invalidate();
    clearHover();
    hover.highlight(pick(event));
    down = { pointerId: event.pointerId, target: hover.target, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }, { signal });

  function processMove(event: PointerEvent) {
    if (!pointerEnabled || !canInteract()) return;
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touches.size===2){
      const next=touchPair()!;
      if(pair){
        if(pair.distance>10&&next.distance>10&&next.distance!==pair.distance)onWheel(-Math.log(next.distance/pair.distance)/.0015,0,bounds.mount().height,next.x,next.y);
        const angle=Math.atan2(Math.sin(next.angle-pair.angle),Math.cos(next.angle-pair.angle));
        if(Math.abs(angle)>.0001)orbit(-angle/.0025,0);
      }
      pair=next;return;
    }
    if (down) {
      if (down.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
      if (down.moved) {
        clearHover();
        orbit(event.clientX - down.lastX, event.clientY - down.lastY);
        down.lastX = event.clientX;
        down.lastY = event.clientY;
      }
      return;
    }
    hover.show(pick(event), event.clientX, event.clientY);
  }
  canvas.addEventListener("pointermove", event => {
    if (!pointerEnabled || !canInteract() || (down && down.pointerId !== event.pointerId&&!touches.has(event.pointerId))) return;
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    // Preserve gesture intent even when a pointer crosses the threshold and
    // returns to its origin before the next frame consumes its latest position.
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
    pendingMove = event;
    requestInputFrame();
  }, { signal });

  canvas.addEventListener("pointerup", event => {
    if(touches.size===2&&touches.has(event.pointerId)){
      discardMove();processMove(event);touches.delete(event.pointerId);pair=undefined;
      const [id,point]=[...touches.entries()][0];
      down={pointerId:id,target:undefined,x:point.x,y:point.y,lastX:point.x,lastY:point.y,moved:true};
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      return;
    }
    if (down?.pointerId !== event.pointerId) return;
    // The release coordinates are the final gesture sample, even before RAF.
    discardMove(); processMove(event);
    const target = down.target;
    const click = event.button===0&&pointerEnabled && canInteract() && !down.moved && Math.hypot(event.clientX-down.x,event.clientY-down.y) <= 6;
    touches.delete(event.pointerId);
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
