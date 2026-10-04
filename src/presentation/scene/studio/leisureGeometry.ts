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
    // Folds gather toward the loaded seat and peter out across the inflated front.
    const pressureDistance=x*x+(z+.08)*(z+.08);
    const creaseEnvelope=gaussian((z+.31)/.46)*(1-seat*.78)*vertical*(1-Math.exp(-pressureDistance/.085));
    const fan=Math.atan2(x,z+.08);
    y-=.024*Math.pow(.5+.5*Math.cos(fan*17+Math.sin(z*9)),8)*creaseEnvelope;
    y+=.009*Math.sin(x*31+Math.sin(z*14)*1.2)*back*vertical+.005*Math.sin(x*43-z*11)*front*vertical;
    y+=.017*Math.sin(x*3.1+z*2.3)*vertical;
  }
  // Flatten the load-bearing underside; a full ellipsoid makes the bag look inflated.
  y=Math.max(.03,y);
  return new THREE.Vector3(x*.91*(1+.025*Math.sin(angle*3)*r),y,z*.77);
}

export function createLoungeShell() {
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const rings=96,segments=160;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const v=loungePanel(i/segments*Math.PI*2,j/rings);positions.push(v.x,v.y,v.z);uvs.push(v.x*2.1,v.z*2.1);
    if(i<segments&&j<rings){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,b+1,a+1,a,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Closed, thin fabric panel with a tensioned edge and sag toward its center. */
export function campCanvasPoint(x:number,v:number,back=false,thickness=0) {
  const u=x/.325,t=v/(back?.215:.28),envelope=Math.max(0,1-u*u)*Math.max(0,1-t*t);
  const folds=.004*Math.sin(u*27+t*8)*Math.exp(-Math.pow((Math.abs(u)-.85)*7,2))*(1-t*t);
  return back?new THREE.Vector3(x,v,thickness+.075*envelope-.15*v+folds):new THREE.Vector3(x,thickness-.080*envelope+folds,v);
}
export function createCampCanvas(back=false) {
  const g=new THREE.BoxGeometry(.65,back?.43:.008,back?.008:.56,48,back?40:1,back?1:40),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),point=campCanvasPoint(x,back?y:z,back,back?z:y);
    p.setXYZ(i,point.x,point.y,point.z);
  }
  g.computeVertexNormals();return g;
}
