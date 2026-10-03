import { islandAppearance as island } from './islandAppearance.ts';

export const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value-a)/(b-a)));
  return t*t*(3-2*t);
};
export function shoreRadius(angle: number) {
  return 1 + island.shoreHarmonics.reduce((sum,[f,a,p])=>sum+a*Math.sin(angle*f+p),0);
}
export function coastRadius(x: number,z: number) {
  const nx=x/island.radiusX,nz=(z-island.centerZ)/island.radiusZ;
  return Math.hypot(nx,nz)/shoreRadius(Math.atan2(nz,nx));
}
export function islandHeight(radius: number) {
  return island.seaLevel*smoothstep(island.plateau,1,radius)-.9*smoothstep(1,1.4,radius);
}
export function terrainHeight(x: number,z: number) {
  const radius=coastRadius(x,z);
  const mound=(cx:number,cz:number,sx:number,sz:number,h:number)=>
    h*Math.exp(-(((x-cx)/sx)**2)-((z-cz)/sz)**2);
  const relief=smoothstep(.46,.65,radius)*(1-smoothstep(.86,1,radius));
  return islandHeight(radius)+relief*(
    mound(-2.8,-4.7,2.7,1.9,.64)+mound(5.4,-1.7,1.8,2.6,.38)
    +mound(-6.1,.2,1.5,2,.29)+.035*Math.sin(x*1.3+Math.sin(z*.8)));
}

// Angles follow the island outline; negative Z is behind the desk.
const clusters = [
  {angle:-1.94,radius:.9,width:1.35,depth:1.0,height:1.85,count:10},
  {angle:-.32,radius:.96,width:1.1,depth:.86,height:1.25,count:8},
  {angle:-3.05,radius:.94,width:.95,depth:.78,height:1.05,count:7},
] as const;
export const islandRocks = clusters.flatMap((cluster,group)=>Array.from({length:cluster.count},(_,i)=>{
  const angle=cluster.angle+Math.sin(i*2.4+group)*.21;
  const radius=cluster.radius+(i===0?0:Math.cos(i*1.7)*.11);
  const outline=shoreRadius(angle)*radius;
  const scale=i===0?1:i<4?.58+(i%3)*.11:.19+(i%3)*.1;
  const x=Math.cos(angle)*island.radiusX*outline,z=Math.sin(angle)*island.radiusZ*outline+island.centerZ;
  return {x,z,width:cluster.width*scale,depth:cluster.depth*scale,height:cluster.height*scale,
    rotation:i*1.71+group*.8,seed:group*31+i+1};
})).concat([
  {x:-4.6,z:3.2,width:.25,depth:.18,height:.21,rotation:.4,seed:101},
  {x:-4.2,z:3.5,width:.14,depth:.11,height:.13,rotation:1.2,seed:102},
  {x:5.1,z:2.7,width:.19,depth:.13,height:.17,rotation:2.1,seed:103},
]);

export function rockBase(rock: typeof islandRocks[number]) {
  return terrainHeight(rock.x,rock.z)-Math.max(.12,rock.height*.24);
}
