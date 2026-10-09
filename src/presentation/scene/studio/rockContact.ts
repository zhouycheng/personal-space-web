import type {BufferGeometry} from 'three';
import {islandAppearance} from '../../../config/islandAppearance.ts';

export const ROCK_SECTION_ANGLES=64;
export const ROCK_SECTION_LEVELS=33;
export const ROCK_SECTION_BOTTOM=islandAppearance.seaLevel-.34;
export const ROCK_SECTION_TOP=islandAppearance.seaLevel+.34;

/** Slice authored triangles once; rows store center X/Z, radius and distance inside vertical bounds. */
// shortcut: one radial boundary fits these solid rocks; use multi-interval sections for caves.
export function rockSectionSamples(geometry:BufferGeometry,rock:{x:number;z:number;rotation:number}) {
  const width=ROCK_SECTION_ANGLES+1, data=new Float32Array(width*ROCK_SECTION_LEVELS*4);
  const positions=geometry.attributes.position,index=geometry.index!,c=Math.cos(rock.rotation),s=Math.sin(rock.rotation);
  geometry.computeBoundingBox();
  const bottom=geometry.boundingBox!.min.y,top=geometry.boundingBox!.max.y;
  const step=(ROCK_SECTION_TOP-ROCK_SECTION_BOTTOM)/(ROCK_SECTION_LEVELS-1);
  const rows:number[][][]=Array.from({length:ROCK_SECTION_LEVELS},()=>[]);
  // Visit only the height rows a triangle crosses, rather than rescan every face per row.
  for(let i=0;i<index.count;i+=3) {
    const ys=[positions.getY(index.getX(i)),positions.getY(index.getX(i+1)),positions.getY(index.getX(i+2))];
    const first=Math.max(0,Math.ceil((Math.min(...ys)-ROCK_SECTION_BOTTOM)/step));
    const last=Math.min(ROCK_SECTION_LEVELS-1,Math.floor((Math.max(...ys)-ROCK_SECTION_BOTTOM)/step));
    for(let row=first;row<=last;row++) {
      const y=ROCK_SECTION_BOTTOM+step*row;
      const points:number[]=[];
      for(let edge=0;edge<3;edge++) {
        const a=index.getX(i+edge),b=index.getX(i+(edge+1)%3),ay=positions.getY(a),by=positions.getY(b);
        if((ay<y)===(by<y))continue;
        const t=(y-ay)/(by-ay),x=positions.getX(a)+(positions.getX(b)-positions.getX(a))*t-rock.x,
          z=positions.getZ(a)+(positions.getZ(b)-positions.getZ(a))*t-rock.z;
        points.push(c*x+s*z,-s*x+c*z);
      }
      if(points.length===4)rows[row].push(points);
    }
  }
  for(let row=0;row<ROCK_SECTION_LEVELS;row++) {
    const segments=rows[row];
    const y=ROCK_SECTION_BOTTOM+step*row,contact=Math.min(y-bottom,top-y);
    for(let angle=0;angle<width;angle++)data[(row*width+angle)*4+3]=contact;
    if(!segments.length)continue;
    let cx=0,cz=0;
    for(const [ax,az,bx,bz] of segments){cx+=ax+bx;cz+=az+bz;}
    cx/=segments.length*2;cz/=segments.length*2;
    for(let angle=0;angle<=ROCK_SECTION_ANGLES;angle++) {
      const theta=angle/ROCK_SECTION_ANGLES*Math.PI*2,dx=Math.cos(theta),dz=Math.sin(theta);
      let radius=0;
      for(const [ax,az,bx,bz] of segments) {
        const x=ax-cx,z=az-cz,ex=bx-ax,ez=bz-az,den=dx*ez-dz*ex;
        if(Math.abs(den)<1e-9)continue;
        const distance=(x*ez-z*ex)/den,along=(x*dz-z*dx)/den;
        if(distance>radius&&along>=0&&along<=1)radius=distance;
      }
      const offset=(row*width+angle)*4;
      data.set([cx,cz,radius,contact],offset);
    }
  }
  // At a vanishing tip only radius/presence fade, rather than moving the center to zero.
  for(let row=0;row<ROCK_SECTION_LEVELS;row++)if(data[row*width*4+3]<=0) {
    let nearest=-1;
    for(let d=1;d<ROCK_SECTION_LEVELS&&nearest<0;d++)for(const candidate of [row-d,row+d])
      if(candidate>=0&&candidate<ROCK_SECTION_LEVELS&&data[candidate*width*4+3]>0){nearest=candidate;break;}
    if(nearest>=0)for(let angle=0;angle<width;angle++) {
      const offset=(row*width+angle)*4;data[offset]=data[nearest*width*4];data[offset+1]=data[nearest*width*4+1];
    }
  }
  return data;
}
