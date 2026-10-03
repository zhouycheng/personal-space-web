import type { RoomView, RoomViewAction } from "../../contracts/studio";
export type { RoomView, RoomViewAction } from "../../contracts/studio";

export const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };

export const ROOM_ZOOM_MIN = 0.85, ROOM_ZOOM_MAX = 2.2;
export { DEFAULT_ROOM_VIEW } from '../../contracts/studio.ts';
import { DEFAULT_ROOM_VIEW } from '../../contracts/studio.ts';
// Keep angles unwrapped: wrapping at +/- PI would make damping spin backwards.
export const clampRoomAngle = (value: number) => Number.isFinite(value) ? value : DEFAULT_ROOM_VIEW.angle;
export const clampRoomElevation = (value: number) => Math.max(0.2, Math.min(1, value));
export const clampRoomZoom = (value: number) => Math.max(ROOM_ZOOM_MIN, Math.min(ROOM_ZOOM_MAX, value));
export function stepRoomView(view:RoomView, action:RoomViewAction):RoomView {
  if(action==="reset-view") return {...DEFAULT_ROOM_VIEW,angle:DEFAULT_ROOM_VIEW.angle+Math.round((view.angle-DEFAULT_ROOM_VIEW.angle)/(Math.PI*2))*Math.PI*2};
  return {
    zoom:clampRoomZoom(view.zoom*(action==="zoom-in"?1.2:action==="zoom-out"?1/1.2:1)),
    angle:clampRoomAngle(view.angle+(action==="view-left"?-0.12:action==="view-right"?0.12:0)),
    elevation:clampRoomElevation(view.elevation+(action==="view-up"?0.08:action==="view-down"?-0.08:0)),
  };
}
// Continuous damping: new input changes the destination, never restarts an easing curve.
export function roomCameraStep(current: number, target: number, elapsed: number) {
  const next = target + (current-target)*Math.exp(-Math.max(0,Math.min(64,elapsed))/55);
  return Math.abs(next-target)<0.00001 ? target : next;
}
export function wheelZoom(current: number, delta: number, mode: number, pageHeight: number) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return clampRoomZoom(current * Math.exp(-pixels * 0.0015));
}

// Move close enough for the fixed surface to cover the view, with a small overscan.
export const surfaceDistance = (width: number, height: number, aspect: number, fov: number) =>
  Math.min(height, width/aspect)/(2*Math.tan(fov*Math.PI/360)*1.15);
export const surfaceOpacity = (progress: number) => smooth((progress-0.48)/0.42);

// Finish facing the screen before travelling along its normal.
export const surfacePhases = (progress: number) => ({
  align: smooth(progress/0.45),
  approach: smooth((progress-0.45)/0.55),
});

/** Align around a device before approaching it, including from the island's rear. */
export function surfaceOrbit(from:readonly number[],via:readonly number[],look:readonly number[],t:number) {
  const ax=from[0]-look[0],az=from[2]-look[2],bx=via[0]-look[0],bz=via[2]-look[2];
  const a=Math.atan2(ax,az),b=Math.atan2(bx,bz),delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const radius=Math.hypot(ax,az)*(1-t)+Math.hypot(bx,bz)*t,angle=a+delta*t;
  return [look[0]+Math.sin(angle)*radius,from[1]*(1-t)+via[1]*t,look[2]+Math.cos(angle)*radius] as const;
}
