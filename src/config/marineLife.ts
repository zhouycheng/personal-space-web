import { islandAppearance as island } from './islandAppearance.ts';
import { shoreRadius, terrainHeight } from './islandTerrain.ts';

/** Coordinates follow the shared shoreline: +Z beach, +X dock. */
export function marinePoint(angle: number, radius: number) {
  const outline = shoreRadius(angle) * radius;
  return { x: Math.cos(angle) * island.radiusX * outline,
    z: island.centerZ + Math.sin(angle) * island.radiusZ * outline };
}

export const marineLife = {
  colonies: [
    { angle: 2.72, radius: 1.36, count: 2, color: 0xad7259 },
    { angle: -2.52, radius: 1.78, count: 1, color: 0x92966a },
    { angle: -.58, radius: 1.54, count: 2, color: 0x9d697e },
  ],
  school: { count: 12, length: .54, period: 46, radius: 1.82, depth: .62 },
  shark: { length: 2.8, period: 125, radius: 6.6, depth: .23 },
  turtle: { length: 1.15, period: 85, radius: 1.70, depth: .66 },
  target: { desktopScale: .65, narrowScale: .5, desktopLimit: 1280, narrowLimit: 1024 },
} as const;

export const marineReefs = marineLife.colonies.flatMap((colony, group) =>
  Array.from({ length: colony.count }, (_, i) => {
    const center = marinePoint(colony.angle + (i - .5) * .13, colony.radius + (i % 2) * .13);
    const base = Math.max(-2.1,terrainHeight(center.x, center.z) - .12);
    return { ...center, width: i === 0 ? .94 : .62, depth: i === 0 ? .72 : .53,
      height: island.seaLevel - base + (i === 0 ? .48 : .16),
      rotation: group * .8 + i * 1.7, seed: 901 + group * 10 + i, burial: 0, base };
  })).concat([
    {angle:-1.55,radius:4.7,width:2.9,depth:1.8,height:4.4},
    {angle:-1.46,radius:4.9,width:1.55,depth:1.25,height:3.35},
    {angle:-1.62,radius:4.85,width:.95,depth:.85,height:2.8},
    {angle:-.62,radius:5.0,width:2.3,depth:1.6,height:3.8},
    {angle:-.53,radius:5.16,width:1.25,depth:.95,height:2.9},
  ].map((rock,i)=>({...marinePoint(rock.angle,rock.radius),width:rock.width,depth:rock.depth,
    height:rock.height,base:-2.3,rotation:i*1.71,seed:970+i,burial:0})));

// World-space distances place these silhouettes near the horizon, beyond the ecology band.
export const horizonIslands = [
  // Each shoreline and ridge is authored independently. Peaks are [x, z, height, spread].
  { angle: -1.59, distance: 145, width: 12, depth: 3.2, rotation: .2,
    peaks: [[-.45, 0, 1.9, .4], [.1, .1, 1.2, .5], [.6, -.2, .7, .22]] },
  { angle: -1.30, distance: 310, width: 6, depth: 5, rotation: -.4,
    peaks: [[-.15, .05, 7.4, .23], [.3, -.2, 2.2, .3]] },
  { angle: -.96, distance: 205, width: 15, depth: 7, rotation: .6,
    peaks: [[-.45, .1, 3.6, .3], [.05, -.15, 1.5, .42], [.5, 0, 5.1, .24]] },
  { angle: -.55, distance: 365, width: 21, depth: 5, rotation: -.2,
    peaks: [[-.55, -.1, 1.2, .25], [-.05, 0, 2.1, .5], [.6, .15, 1.5, .25]] },
  { angle: -.20, distance: 175, width: 4, depth: 3, rotation: .8,
    peaks: [[.15, -.1, 3.2, .4]] },
  { angle: .85, distance: 270, width: 17, depth: 8, rotation: 1.1,
    peaks: [[-.35, -.2, 2.6, .32], [.3, .15, 4.8, .37]] },
  { angle: 2.5, distance: 225, width: 9, depth: 4, rotation: -.7,
    peaks: [[-.2, 0, 4.4, .4], [.55, .1, 1.1, .2]] },
] as const;
