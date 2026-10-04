import { DEFAULT_ROOM_VIEW } from '../../contracts/studio.ts';
export const ENTRANCE_DURATION = 3000;
export const ENTRANCE_PITCH = Math.PI / 3;
export const ENTRANCE_AZIMUTH = DEFAULT_ROOM_VIEW.angle + 55 * Math.PI / 180;
export const ENTRANCE_OCCUPANCY = .3;
export const entranceContentProgress = (progress:number) => Math.max(0,Math.min(1,(progress-.28)/.72));
export const entranceBlend = (progress:number) => {const t=Math.max(0,Math.min(1,(progress-.3)/.43));return t*t*(3-2*t);};

/** True spherical pitch, separate from the ordinary room elevation parameter. */
export function entrancePose(progress: number, startDistance: number, end: readonly number[], focus: readonly number[]) {
  const t = Math.max(0, Math.min(1, (progress - .1) / .9));
  const eased = t * t * t * (t * (t * 6 - 15) + 10);
  const dx = end[0] - focus[0], dy = end[1] - focus[1], dz = end[2] - focus[2];
  const endDistance = Math.hypot(dx, dy, dz);
  const pitch = ENTRANCE_PITCH + (Math.atan2(dy, Math.hypot(dx, dz)) - ENTRANCE_PITCH) * eased;
  const angle = ENTRANCE_AZIMUTH + (Math.atan2(dx, dz) - ENTRANCE_AZIMUTH) * eased;
  const distance = startDistance * (endDistance / startDistance) ** eased;
  if (progress >= 1) return [...end];
  return [focus[0] + Math.sin(angle) * Math.cos(pitch) * distance, focus[1] + Math.sin(pitch) * distance, focus[2] + Math.cos(angle) * Math.cos(pitch) * distance];
}
