import { oceanWaves, shoreWaves } from '../../config/oceanWaves.ts';
import { coastRadius,smoothstep } from '../../config/islandTerrain.ts';
import { islandAppearance } from '../../config/islandAppearance.ts';

/** Height, spatial derivatives and vertical velocity of the nearshore wash. */
export function shoreWash(x:number,z:number,time:number) {
  const result=[0,0,0,0];
  for(const [amplitude,speed,kx,kz,phase] of shoreWaves) {
    const angle=time*speed+x*kx+z*kz+phase, slope=amplitude*Math.cos(angle);
    result[0]+=amplitude*Math.sin(angle);result[1]+=slope*kx;result[2]+=slope*kz;result[3]+=slope*speed;
  }
  return result;
}

/** Sample the same anchored wave packets used by the water vertex shader. */
export function oceanHeight(x:number,z:number,time:number) {
  const r=coastRadius(x,z);
  let height=0;
  oceanWaves.forEach(([length,amplitude,direction,phase],i)=>{
    const k=Math.PI*2/length,cross=direction+1.15+i*.37;
    const warp=(Math.cos(cross)*x+Math.sin(cross)*z)*k*.23+time*.035+phase*1.71;
    const packet=(Math.cos(direction-.8)*x+Math.sin(direction-.8)*z)*k*.13-time*.045+phase*2.13;
    const theta=(Math.cos(direction)*x+Math.sin(direction)*z)*k-Math.sqrt(9.81*k)*time*.45+phase+.9*Math.sin(warp);
    height+=amplitude*Math.sin(theta)*(.72+.28*Math.sin(packet));
  });
  const wash=shoreWash(x,z,time)[0]*(1-smoothstep(1.03,1.45,r));
  return islandAppearance.seaLevel+height*smoothstep(1.05,1.65,r)+wash;
}
