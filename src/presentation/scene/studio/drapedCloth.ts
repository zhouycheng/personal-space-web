import * as THREE from 'three';

/** Relax a linen throw once, with inextensible yarns, a supporting rim and sand contact. */
export function createDrapedCloth(width:number,length:number,height:number,radius:number,rolls=false) {
  const nx=24,ny=48,stride=nx+1,count=stride*(ny+1),points=new Float64Array(count*3);
  const previous=new Float64Array(count*3),weights=new Float64Array(count).fill(1);
  const rollCenters=[[-.092,-.074],[.09,-.058]];
  const dx=width/nx,dy=length/ny,links:{a:number;b:number;length:number;stiffness:number}[]=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++) {
    const id=j*stride+i,k=id*3,u=i/nx-.5,s=j*dy,edge=radius+.016;
    points[k]=u*width*(.84+.16*Math.min(1,s/.18));
    const bend=Math.max(0,s-radius*.9),drop=Math.max(0,bend-.07);
    points[k+1]=Math.max(.009,height+.035-drop)+.008*Math.sin(u*13+s*9);
    points[k+2]=s<radius*.9?s-radius*.45:edge+.015*Math.sin(u*17)+Math.max(0,drop-height)*.9;
    if(rolls)for(const [cx,cz] of rollCenters) {
      const radial=((points[k]-cx)/.102)**2+((points[k+2]-cz)/.108)**2;
      if(radial<1)points[k+1]=Math.max(points[k+1],.335+.145*Math.sqrt(1-radial)+.003);
    }
    if(j===0)weights[id]=0;
    if(i<nx)links.push({a:id,b:id+1,length:dx,stiffness:1});
    if(j<ny)links.push({a:id,b:id+stride,length:dy,stiffness:1});
    if(i<nx&&j<ny) {
      links.push({a:id,b:id+stride+1,length:Math.hypot(dx,dy),stiffness:.7});
      links.push({a:id+1,b:id+stride,length:Math.hypot(dx,dy),stiffness:.7});
    }
    if(i<nx-1)links.push({a:id,b:id+2,length:dx*2,stiffness:.025});
    if(j<ny-1)links.push({a:id,b:id+stride*2,length:dy*2,stiffness:.025});
  }
  previous.set(points);
  for(let step=0;step<220;step++) {
    for(let i=0;i<count;i++)if(weights[i])for(let axis=0;axis<3;axis++) {
      const k=i*3+axis,value=points[k];points[k]+=(value-previous[k])*.72-(axis===1?.00016:0);previous[k]=value;
    }
    for(let iteration=0;iteration<7;iteration++) {
      for(const link of links) {
        const a=link.a*3,b=link.b*3,w=weights[link.a]+weights[link.b];if(!w)continue;
        const x=points[b]-points[a],y=points[b+1]-points[a+1],z=points[b+2]-points[a+2],d=Math.hypot(x,y,z);
        const correction=(d-link.length)/Math.max(d,1e-9)*link.stiffness/w;
        for(let axis=0;axis<3;axis++) {
          const value=(axis===0?x:axis===1?y:z)*correction;
          points[a+axis]+=value*weights[link.a];points[b+axis]-=value*weights[link.b];
        }
      }
      for(let i=0;i<count;i++)if(weights[i]) {
        const k=i*3,x=points[k],y=points[k+1],z=points[k+2],r=Math.hypot(x,z);
        // The filled basket supports the upper sheet; the taper keeps the hanging skirt outside.
        if(y>height-.055&&r<radius+.008)points[k+1]=Math.max(y,height+.012);
        else if(y<height+.012&&y>.008) {
          const wall=radius*(.79+.21*Math.min(1,y/height))+.011;
          if(r<wall){points[k]*=wall/Math.max(r,1e-6);points[k+2]*=wall/Math.max(r,1e-6);}
        }
        points[k+1]=Math.max(.009,points[k+1]);
        if(rolls)for(const [cx,cz] of rollCenters) {
          const x=(points[k]-cx)/.102,y=(points[k+1]-.335)/.145,z=(points[k+2]-cz)/.108,d=Math.hypot(x,y,z);
          if(d<1){const scale=1/Math.max(d,1e-8);points[k]=cx+x*scale*.102;points[k+1]=.335+y*scale*.145;points[k+2]=cz+z*scale*.108;}
        }
      }
    }
  }
  const geometry=new THREE.PlaneGeometry(1,1,nx,ny),position=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++) {
    const id=j*stride+i,k=id*3;position.setXYZ(id,points[k],points[k+1],points[k+2]);uv.setXY(id,i/nx*width*3,j/ny*length*3);
  }
  geometry.computeVertexNormals();
  const edge=(j:number)=>Array.from({length:stride},(_,i)=>{const k=(j*stride+i)*3;return new THREE.Vector3(points[k],points[k+1],points[k+2]);});
  return {geometry,hem:edge(ny)};
}
