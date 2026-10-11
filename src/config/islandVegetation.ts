import { terrainHeight } from './islandTerrain.ts';
import { dressingFerns } from './islandDressing.ts';
import { livingFerns } from './islandLiving.ts';

// Keep tall trunks behind and beside the workspace; the front beach stays open.
export const islandPalms = [
  {x:-3.9,z:-4.0,height:5.6,leanX:-.7,leanZ:.15,crown:2.25,seed:3},
  {x:-4.42,z:-1.65,height:5.2,leanX:-.1,leanZ:-.15,crown:1.9,seed:11},
  {x:4.8,z:-3.0,height:4.7,leanX:.45,leanZ:-.25,crown:2.1,seed:23},
  {x:.5,z:-5.2,height:3.9,leanX:.25,leanZ:-.4,crown:1.8,seed:37},
  {x:-5.1,z:2.55,height:4.3,leanX:-.2,leanZ:.18,crown:1.65,seed:53},
  {x:4.7,z:2.8,height:3.65,leanX:.35,leanZ:.12,crown:1.55,seed:61},
  {x:2.9,z:-4.5,height:3.0,leanX:-.22,leanZ:-.26,crown:1.45,seed:73},
] as const;

export const islandUnderstory = [
  ...dressingFerns,
  ...livingFerns,
  {x:-5.5,z:-4.01,scale:.8,seed:4}, {x:-5.46,z:.12,scale:.65,seed:12},
  {x:-6.84,z:1.16,scale:.4,seed:17}, {x:5.07,z:-4.28,scale:.75,seed:24},
  {x:3.94,z:-4.72,scale:.6,seed:31}, {x:1.43,z:-4.88,scale:.55,seed:42},
  {x:-5.43,z:1.25,scale:.62,seed:81},{x:-6.36,z:4.48,scale:.48,seed:83},
  {x:5.19,z:5.19,scale:.3,seed:97},
  {x:6.26,z:3.33,scale:.26,seed:101},
  {x:4.43,z:-3.89,scale:.52,seed:109},
  {x:2.71,z:-5.71,scale:.7,seed:113},{x:-.59,z:-4.85,scale:.64,seed:127},
  {x:-4.6,z:-.37,scale:.42,seed:419},{x:-6.53,z:1.89,scale:.38,seed:421},
  {x:-5.18,z:-.41,scale:.43,seed:431},{x:-7.43,z:1.31,scale:.34,seed:433},
  {x:4.37,z:1.34,scale:.23,seed:439},{x:6.68,z:2.64,scale:.26,seed:457},
  {x:5.63,z:-1.1,scale:.36,seed:461},{x:4.34,z:-2.1,scale:.38,seed:463},
] as const;

/** Trunk center above the sand, shared by the mesh and hammock bindings. */
export function palmTrunkCenter(palm:typeof islandPalms[number],height:number):[number,number,number] {
  const t=(height+.2)/(palm.height+.14);
  return [palm.x+palm.leanX*t*t,terrainHeight(palm.x,palm.z)+height,palm.z+palm.leanZ*t*t];
}

export const palmBounds = islandPalms.map(palm=>({
  x:palm.x+palm.leanX,z:palm.z+palm.leanZ,
  top:terrainHeight(palm.x,palm.z)+palm.height+palm.crown*.65,
  radius:palm.crown*1.35,
}));
