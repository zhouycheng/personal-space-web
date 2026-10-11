import * as THREE from 'three';
import { islandPalms,palmTrunkCenter } from '../../../config/islandVegetation.ts';
import { hammockLayout } from '../../../config/islandLiving.ts';

export function hammockAnchors() {
  return [hammockLayout.frontPalmSeed,hammockLayout.rearPalmSeed].map(seed=>
    new THREE.Vector3(...palmTrunkCenter(islandPalms.find(palm=>palm.seed===seed)!,hammockLayout.attachmentHeight)));
}

// The catenary carries the weight between the two gathered ends.
function catenary(u:number,sag:number,span:number) {
  let low=.15,high=20;
  for(let i=0;i<32;i++) {const a=(low+high)/2;if(a*(Math.cosh(span/(2*a))-1)>sag)low=a;else high=a;}
  const a=(low+high)/2;
  return a*(Math.cosh(span/(2*a))-Math.cosh((u-.5)*span/a));
}

/** Gathered ends carry a sagging woven bed; the right edge opens toward the dock. */
export function hammockPoint(u:number,v:number,anchors=hammockAnchors()) {
  const [a,b]=anchors,direction=b.clone().sub(a).normalize();
  const across=new THREE.Vector3(-direction.z,0,direction.x).normalize();
  const envelope=Math.sin(Math.PI*u),point=a.clone().lerp(b,.12+.76*u);
  const halfWidth=.07+hammockLayout.width*.5*Math.pow(envelope,.72);
  point.addScaledVector(across,v*halfWidth);
  point.y-=.29+catenary(u,hammockLayout.sag,a.distanceTo(b)*.76);
  point.y+=(.37*v*v-.115*v)*Math.pow(envelope,.72);
  const gather=(Math.exp(-u*7)+Math.exp(-(1-u)*7))*envelope;
  point.y+=.07*Math.sin(v*27+u*2)*gather+.009*Math.sin(v*13+u*8)*envelope;
  point.y-=.045*Math.exp(-(((u-.32)/.13)**2+((v+.1)/.55)**2));
  return point;
}

/** The cushion's compressed underside follows the supporting cloth at every point. */
export function hammockCushionPoint(x:number,y:number,z:number,anchors=hammockAnchors()) {
  const u=.32+z/(anchors[0].distanceTo(anchors[1])*.76);
  const halfWidth=.07+hammockLayout.width*.5*Math.pow(Math.sin(Math.PI*u),.72);
  const point=hammockPoint(u,-.1+x/halfWidth,anchors);
  point.y+=.006+(y+.11)*.82;
  return point;
}

export function createHammockGeometry() {
  const anchors=hammockAnchors(),g=new THREE.PlaneGeometry(1,1,72,40),position=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<position.count;i++){
    const point=hammockPoint(position.getX(i)+.5,position.getY(i)*2,anchors);
    position.setXYZ(i,point.x,point.y,point.z);uv.setXY(i,uv.getX(i)*7,uv.getY(i)*3);
  }
  g.computeVertexNormals();return g;
}
