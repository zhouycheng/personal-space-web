import { workspaceAppearance as layout } from '../../config/workspaceAppearance.ts';

/** Conservative roof envelope prevents the camera entering a visible cloth face. */
export function canopyOpacity(camera: readonly number[], target: readonly number[]) {
  const c=layout.canopy, low=c.height-.5, high=c.height+.25;
  const inside=(x:number,z:number)=>x>c.left-.15&&x<c.right+.15&&z>c.back-.15&&z<c.front+.15;
  if(inside(camera[0],camera[2])&&camera[1]>low-.35&&camera[1]<high+.35)return 0;
  const dy=target[1]-camera[1];
  if(Math.abs(dy)<.0001)return 1;
  for(const y of [low,high]) {
    const t=(y-camera[1])/dy;
    if(t>0&&t<1&&inside(camera[0]+(target[0]-camera[0])*t,camera[2]+(target[2]-camera[2])*t))return 0;
  }
  return 1;
}
