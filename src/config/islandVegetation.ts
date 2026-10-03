import { terrainHeight } from './islandTerrain.ts';
import { dressingFerns } from './islandDressing.ts';

// Keep tall trunks behind and beside the workspace; the front beach stays open.
export const islandPalms = [
  {x:-3.9,z:-4.0,height:5.6,leanX:-.7,leanZ:.15,crown:2.25,seed:3},
  {x:-5.6,z:-.7,height:4.25,leanX:-.6,leanZ:.25,crown:1.9,seed:11},
  {x:4.8,z:-3.0,height:4.7,leanX:.45,leanZ:-.25,crown:2.1,seed:23},
  {x:.5,z:-5.2,height:3.9,leanX:.25,leanZ:-.4,crown:1.8,seed:37},
  {x:-5.0,z:2.05,height:3.45,leanX:-.35,leanZ:.16,crown:1.5,seed:53},
  {x:4.7,z:2.8,height:3.65,leanX:.35,leanZ:.12,crown:1.55,seed:61},
  {x:2.9,z:-4.5,height:3.0,leanX:-.22,leanZ:-.26,crown:1.45,seed:73},
] as const;

export const islandUnderstory = [
  ...dressingFerns,
  {x:-4.8,z:-3.6,scale:.8,seed:4}, {x:-5.9,z:.3,scale:.65,seed:12},
  {x:-5.1,z:1.1,scale:.5,seed:17}, {x:5.3,z:-1.9,scale:.75,seed:24},
  {x:4.3,z:-3.8,scale:.6,seed:31}, {x:1.5,z:-4.9,scale:.55,seed:42},
  {x:-5.1,z:2.0,scale:.62,seed:81},{x:-5.5,z:3.2,scale:.48,seed:83},
  {x:-4.9,z:4.5,scale:.45,seed:89},{x:4.5,z:2.8,scale:.68,seed:97},
  {x:5.0,z:3.5,scale:.48,seed:101},{x:3.7,z:4.2,scale:.56,seed:103},
  {x:3.35,z:5.15,scale:.38,seed:107},{x:5.4,z:.1,scale:.52,seed:109},
  {x:2.8,z:-4.4,scale:.7,seed:113},{x:-2.3,z:-4.9,scale:.64,seed:127},
  {x:-4.65,z:3.85,scale:.36,seed:401},{x:-4.65,z:4.65,scale:.34,seed:409},
  {x:-5.3,z:2.6,scale:.42,seed:419},{x:-4.7,z:1.65,scale:.38,seed:421},
  {x:-5.5,z:-1.15,scale:.43,seed:431},{x:-5.0,z:-2.3,scale:.34,seed:433},
  {x:4.15,z:3.05,scale:.37,seed:439},{x:4.65,z:4.0,scale:.4,seed:443},
  {x:3.5,z:4.65,scale:.32,seed:449},{x:5.1,z:2.1,scale:.39,seed:457},
  {x:5.45,z:-.65,scale:.36,seed:461},{x:4.65,z:-1.5,scale:.38,seed:463},
] as const;

export const palmBounds = islandPalms.map(palm=>({
  x:palm.x+palm.leanX,z:palm.z+palm.leanZ,
  top:terrainHeight(palm.x,palm.z)+palm.height+palm.crown*.65,
  radius:palm.crown*1.35,
}));
