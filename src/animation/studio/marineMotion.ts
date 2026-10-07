import { marineLife, marinePoint } from '../../config/marineLife.ts';
import { islandAppearance } from '../../config/islandAppearance.ts';
import { oceanHeight } from './oceanSurface.ts';

export type MarineKind = 'school' | 'shark' | 'turtle';
const tau = Math.PI * 2;

function position(kind: MarineKind, time: number, group: number, index: number) {
  const settings = marineLife[kind];
  const phase = time / settings.period * tau;
  const seed = index * 2.399963 + group * 1.7;
  let angle: number, radius: number;
  if (kind === 'shark') {
    angle = -1.12 + .35 * Math.sin(phase - .9);
    radius = settings.radius + .25 * Math.cos(phase - .9);
  } else if (kind === 'turtle') {
    angle = 2.18 + .12 * Math.sin(phase);
    radius = settings.radius + .14 * Math.cos(phase);
  } else {
    angle = marineLife.colonies[group].angle - (group === 0 ? .35 : 0) + .12 * Math.sin(phase + group)
      + .095 * Math.sin(seed) * (1 + .12 * Math.sin(phase * 3 + seed));
    radius = marineLife.colonies[group].radius + (group === 0 ? .32 : .49) + .10 * Math.cos(phase + group) + .062 * Math.cos(seed);
  }
  const point=marinePoint(angle,radius);
  return { ...point,
    y: kind==='shark'?oceanHeight(point.x,point.z,time)-settings.depth:
      islandAppearance.seaLevel - settings.depth + (kind==='school'?.055:.025) * Math.sin(phase * 2 + seed) };
}

/** Closed paths, sampled from ocean time, with tangent heading even at loop seams. */
export function marinePose(kind: MarineKind, time: number, group = 0, index = 0) {
  const point = position(kind, time, group, index);
  const before = position(kind, time - .02, group, index);
  const after = position(kind, time + .02, group, index);
  return { ...point, heading: -Math.atan2(after.z - before.z, after.x - before.x) };
}
