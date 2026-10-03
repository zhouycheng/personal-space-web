import { islandAppearance as island } from './islandAppearance.ts';
import { dressingRocks } from './islandDressing.ts';

export const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value-a)/(b-a)));
  return t*t*(3-2*t);
};
export function shoreRadius(angle: number) {
  return 1 + island.shoreHarmonics.reduce((sum,[f,a,p])=>sum+a*Math.sin(angle*f+p),0)
    + island.shoreExtensions.reduce((sum,[direction,amount,spread])=>sum+amount*Math.exp((Math.cos(angle-direction)-1)/(spread*spread)),0);
}
export function coastRadius(x: number,z: number) {
  const nx=x/island.radiusX,nz=(z-island.centerZ)/island.radiusZ;
  return Math.hypot(nx,nz)/shoreRadius(Math.atan2(nz,nx));
}
export function islandHeight(radius: number) {
  // A continuous slope through the waterline avoids a flat shelf and a hard rim.
  return island.seaLevel*Math.pow(Math.max(0,(radius-island.plateau)/(1-island.plateau)),1.65)
    -.32*smoothstep(1,1.16,radius);
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
],dressingRocks,
  // Uneven offshore groups: leave the eastern dock approach free.
  Array.from({length:25},(_,i)=>{
    const angles=[2.65,-2.8,1.65,.75,-.9],a=i*2.39996;
    const direction=angles[Math.floor(i/5)]+Math.sin(a)*.1;
    const r=shoreRadius(direction)*(1.04+(i%5)*.026);
    const scale=i%5===0?1:.32+(i%3)*.15;
    return {x:Math.cos(direction)*island.radiusX*r,z:island.centerZ+Math.sin(direction)*island.radiusZ*r,width:.65*scale,depth:.51*scale,
      height:(i%5===0?.83:.38)*scale,rotation:a,seed:701+i};
  }));

export function rockBase(rock: typeof islandRocks[number]) {
  return terrainHeight(rock.x,rock.z)-('burial' in rock?rock.height*Number(rock.burial):Math.max(.12,rock.height*.24));
}
