import { workspaceAppearance as layout } from '../../config/workspaceAppearance.ts';

const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

/** The roof belongs in the island overview, but clears the desk inspection area
 * even at eye level. Distance, rather than a far-away sightline, owns visibility. */
export function canopyDistanceOpacity(camera:readonly number[]) {
  return smooth((Math.hypot(camera[0]+.1,camera[1]-1.43,camera[2]+1.25)-7)/4);
}

/** Begin fading before the sightline reaches the cloth, including its wind
 * envelope. Low frontal views remain clear without hiding the roof. */
export function canopyOpacity(camera: readonly number[], target: readonly number[]) {
  const c=layout.canopy, low=c.height-.5, high=c.height+.25;
  const horizontalDistance=(x:number,z:number)=>Math.hypot(Math.max(c.left-.15-x,0,x-c.right-.15),Math.max(c.back-.15-z,0,z-c.front-.15));
  const verticalDistance=Math.max(low-.35-camera[1],0,camera[1]-high-.35);
  let opacity=smooth(Math.hypot(horizontalDistance(camera[0],camera[2]),verticalDistance)/.8);
  const dy=target[1]-camera[1];
  if(Math.abs(dy)<.0001)return opacity;
  for(const y of [low,(low+high)/2,high]) {
    const t=(y-camera[1])/dy;
    if(t>0&&t<1)opacity=Math.min(opacity,smooth(horizontalDistance(camera[0]+(target[0]-camera[0])*t,camera[2]+(target[2]-camera[2])*t)/.8));
  }
  return opacity;
}

export function fadeCanopyOpacity(current:number,target:number,elapsed:number,reduced=false) {
  if(reduced)return target;
  const next=current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(50,elapsed))/(target<current?180:300)));
  return Math.abs(next-target)<.001?target:next;
}
