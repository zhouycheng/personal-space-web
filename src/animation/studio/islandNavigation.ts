import { coastRadius } from '../../config/islandTerrain.ts';
import { islandAppearance } from '../../config/islandAppearance.ts';

export type IslandFocus={x:number;y:number;z:number};
export function acceptsIslandFocus(point:IslandFocus) {
  return Number.isFinite(point.x+point.y+point.z)&&point.y>=islandAppearance.seaLevel&&coastRadius(point.x,point.z)<=.92;
}
export function clampIslandFocus(point:IslandFocus):IslandFocus {
  if(!Number.isFinite(point.x+point.y+point.z))return {x:0,y:.35,z:islandAppearance.centerZ};
  const radius=coastRadius(point.x,point.z),scale=radius>.86?.86/radius:1;
  return {x:point.x*scale,y:Math.max(.25,Math.min(2.8,point.y)),z:islandAppearance.centerZ+(point.z-islandAppearance.centerZ)*scale};
}
