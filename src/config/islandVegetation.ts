import { terrainHeight } from './islandTerrain.ts';

// Keep tall trunks behind and beside the workspace; the front beach stays open.
export const islandPalms = [
  {x:-3.9,z:-4.0,height:5.6,leanX:-.7,leanZ:.15,crown:2.25,seed:3},
  {x:-5.6,z:-.7,height:4.25,leanX:-.6,leanZ:.25,crown:1.9,seed:11},
  {x:4.8,z:-3.0,height:4.7,leanX:.45,leanZ:-.25,crown:2.1,seed:23},
  {x:.5,z:-5.2,height:3.9,leanX:.25,leanZ:-.4,crown:1.8,seed:37},
] as const;

export const islandUnderstory = [
  {x:-4.8,z:-3.6,scale:.8,seed:4}, {x:-5.9,z:.3,scale:.65,seed:12},
  {x:-5.1,z:1.1,scale:.5,seed:17}, {x:5.3,z:-1.9,scale:.75,seed:24},
  {x:4.3,z:-3.8,scale:.6,seed:31}, {x:1.5,z:-4.9,scale:.55,seed:42},
] as const;

export const palmBounds = islandPalms.map(palm=>({
  x:palm.x+palm.leanX,z:palm.z+palm.leanZ,
  top:terrainHeight(palm.x,palm.z)+palm.height+palm.crown*.65,
  radius:palm.crown*1.35,
}));
