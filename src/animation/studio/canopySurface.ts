import {workspaceAppearance} from '../../config/workspaceAppearance.ts';
import {breezeAt,breezeGLSL} from './breeze.ts';

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

// Color, hems and shadow depth all evaluate exactly the same anchored surface.
const c=workspaceAppearance.canopy;
export const canopySurfaceGLSL=`${breezeGLSL}
vec3 canopySurface(vec2 uv,float t) {
  float u=uv.x,v=uv.y,su=sin(3.14159265359*u),sv=sin(3.14159265359*v);
  float x=${c.left.toFixed(6)}+${(c.right-c.left).toFixed(6)}*u+.13*sv*(1.-2.*u);
  float z=${c.back.toFixed(6)}+${(c.front-c.back).toFixed(6)}*v+.13*su*(1.-2.*v);
  float loose=(su+sv)*.5,wave=breezeAt(vec2(x,z),t),edge=1.-su*sv;
  float y=${c.height.toFixed(6)}+.15*u-.12*v-.18*(su+sv)+.012*sin(u*31.+v*9.)*su*sv
    +loose*(.075*wave+.015*edge*sin(t*3.2-u*11.-v*8.)*(1.-exp(-t*.7)));
  return vec3(x+.017*loose*wave,y,z+.01*loose*wave);
}`;
