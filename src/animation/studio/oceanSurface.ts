import { oceanWaves } from '../../config/oceanWaves.ts';
import { coastRadius,smoothstep } from '../../config/islandTerrain.ts';
import { islandAppearance } from '../../config/islandAppearance.ts';

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
  const wash=.026*Math.sin(time*.72+x*.17+z*.11)*(1-smoothstep(1.03,1.45,r));
  return islandAppearance.seaLevel+height*smoothstep(1.05,1.65,r)+wash;
}
