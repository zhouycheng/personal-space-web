import {workspaceAppearance} from '../../config/workspaceAppearance.ts';
import {breezeAt} from './breeze.ts';

/** Four pinned corners, concave edges and wind travelling across the tensioned sail. */
export function canopySurface(u:number,v:number,time=0) {
  const c=workspaceAppearance.canopy,su=Math.sin(Math.PI*u),sv=Math.sin(Math.PI*v);
  const x=c.left+(c.right-c.left)*u+.13*sv*(1-2*u);
  const z=c.back+(c.front-c.back)*v+.13*su*(1-2*v);
  const loose=(su+sv)*.5,wave=breezeAt(x,z,time),edge=1-su*sv;
  const fold=.012*Math.sin(u*31+v*9)*su*sv;
  const y=c.height+.15*u-.12*v-.18*(su+sv)+fold
    +loose*(.075*wave+.015*edge*Math.sin(time*3.2-u*11-v*8)*(1-Math.exp(-time*.7)));
  return {x:x+.017*loose*wave,y,z:z+.01*loose*wave};
}
