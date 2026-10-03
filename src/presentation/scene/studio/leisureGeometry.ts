import * as THREE from 'three';

/** Reference beanbag: a wide filled base, substantial front bolster and slumped back.
 * The seat rests high in the filling, rather than forming a hollow shell. */
export function loungePanel(angle:number,t:number) {
  const r=Math.sin(Math.PI*t),vertical=-Math.cos(Math.PI*t);
  const rounded=(v:number)=>Math.sign(v)*Math.abs(v)**.88;
  const x=r*rounded(Math.cos(angle)),z=r*rounded(Math.sin(angle));
  const gaussian=(v:number)=>Math.exp(-v*v);
  let y=.03+.15*(1+vertical)**3;
  if(vertical>=0){
    const back=gaussian((z+.57)/.34)*Math.exp(-(Math.abs(x/.95)**6));
    const sides=gaussian((Math.abs(x)-.73)/.20)*gaussian((z+.05)/.8);
    const seat=gaussian(x/.5)*gaussian((z-.12)/.42);
    const front=gaussian((z-.64)/.23);
    // Sculpt the filling as connected masses, not a raised ring around a hole.
    y=.18+.28*vertical+.51*back*vertical**.6+.17*sides*vertical**.5
      -.15*seat*vertical+.18*front*vertical;
    y+=.012*Math.sin(x*31+Math.sin(z*14)*1.2)*back*vertical+.006*Math.sin(x*43-z*11)*front*vertical;
    y+=.012*Math.sin(x*4+z*3)*vertical;
  }
  return new THREE.Vector3(x*.91,y,z*.77);
}

export function createLoungeShell() {
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const rings=96,segments=160;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const v=loungePanel(i/segments*Math.PI*2,j/rings);positions.push(v.x,v.y,v.z);uvs.push(i/segments,j/rings);
    if(i<segments&&j<rings){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b+1,a+1,a,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Closed, thin fabric panel with a tensioned edge and sag toward its center. */
export function createCampCanvas(back=false) {
  const g=new THREE.BoxGeometry(.65,back?.43:.025,back?.025:.56,24,back?20:1,back?1:20),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),u=x/.325;
    if(back){const v=y/.215;p.setXYZ(i,x,y,z+.062*(1-u*u)*(1-v*v)+.12*y);}
    else {const v=z/.28;p.setXYZ(i,x,y-.065*(1-u*u)*(1-v*v),z);}
  }
  g.computeVertexNormals();return g;
}
