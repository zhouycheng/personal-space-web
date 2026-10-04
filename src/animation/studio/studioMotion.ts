import type { RoomView, RoomViewAction } from "../../contracts/studio";
export type { RoomView, RoomViewAction } from "../../contracts/studio";

export const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };

export const ROOM_ZOOM_MIN = 0.85, ROOM_ZOOM_MAX = 2.2;
export const CAMERA_ZOOM_OMEGA = 56;
export { DEFAULT_ROOM_VIEW } from '../../contracts/studio.ts';
import { DEFAULT_ROOM_VIEW } from '../../contracts/studio.ts';
// Keep angles unwrapped: wrapping at +/- PI would make damping spin backwards.
export const clampRoomAngle = (value: number) => Number.isFinite(value) ? value : DEFAULT_ROOM_VIEW.angle;
export const clampRoomElevation = (value: number) => Math.max(0.2, Math.min(1, value));
export const clampRoomZoom = (value: number) => Math.max(ROOM_ZOOM_MIN, Math.min(ROOM_ZOOM_MAX, value));
export function stepRoomView(view:RoomView, action:RoomViewAction):RoomView {
  if(action==="reset-view") return {...DEFAULT_ROOM_VIEW,angle:DEFAULT_ROOM_VIEW.angle+Math.round((view.angle-DEFAULT_ROOM_VIEW.angle)/(Math.PI*2))*Math.PI*2};
  return {
    ...view,
    zoom:clampRoomZoom(view.zoom*(action==="zoom-in"?1.2:action==="zoom-out"?1/1.2:1)),
    angle:clampRoomAngle(view.angle+(action==="view-left"?-0.12:action==="view-right"?0.12:0)),
    elevation:clampRoomElevation(view.elevation+(action==="view-up"?0.08:action==="view-down"?-0.08:0)),
  };
}
// Critically damped tracking retains speed when a gesture changes direction.
export function roomCameraStep(current: number, target: number, elapsed: number, state: {velocity:number}, omega=44) {
  const dt=Math.max(0,Math.min(64,elapsed))/1000,x=current-target;
  const b=state.velocity+omega*x,e=Math.exp(-omega*dt);
  const next=target+(x+b*dt)*e;
  state.velocity=(state.velocity-omega*b*dt)*e;
  if(Math.abs(next-target)<.00001&&Math.abs(state.velocity)<.0001){state.velocity=0;return target;}
  return next;
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

/** Position and velocity meet at alignment; the camera need not stop to start its approach. */
export function surfaceFlight(from:readonly number[],via:readonly number[],to:readonly number[],look:readonly number[],progress:number) {
  const p=Math.max(0,Math.min(1,progress)),split=.45;
  const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const approachDistance=distance(via,to),speed=.7*Math.min(distance(from,via)/split,approachDistance/(1-split));
  const m=approachDistance>1e-8?speed*(1-split)/approachDistance:0;
  const hermite=(t:number,a:number,b:number,endSlope:number)=>a+(b-a)*smooth(t)+endSlope*(t*t*t-t*t);
  if(p<=split){
    const t=p/split,aligned=smooth(t),orbit=surfaceOrbit(from,via,look,aligned);
    const r0=Math.hypot(from[0]-look[0],from[2]-look[2]),r1=Math.hypot(via[0]-look[0],via[2]-look[2]);
    const radialSlope=r1>1e-8?((to[0]-via[0])*(via[0]-look[0])+(to[2]-via[2])*(via[2]-look[2]))/r1:0;
    const factor=approachDistance>1e-8?speed*split/approachDistance:0;
    const radius=hermite(t,r0,r1,radialSlope*factor),angle=Math.atan2(orbit[0]-look[0],orbit[2]-look[2]);
    return [look[0]+Math.sin(angle)*radius,hermite(t,from[1],via[1],(to[1]-via[1])*factor),look[2]+Math.cos(angle)*radius] as const;
  }
  const t=(p-split)/(1-split),f=(m-2)*t*t*t+(3-2*m)*t*t+m*t;
  return [via[0]+(to[0]-via[0])*f,via[1]+(to[1]-via[1])*f,via[2]+(to[2]-via[2])*f] as const;
}
