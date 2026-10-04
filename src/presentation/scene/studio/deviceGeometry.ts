import * as THREE from 'three';

/** Independent outline radii: thin metal panels keep flat sides instead of
 * becoming pill-shaped when a 3D fillet is limited by their thickness. */
export function deviceOutline(width:number,height:number,topRadius:number,bottomRadius=topRadius) {
  const x=width/2,y=height/2,t=topRadius,b=bottomRadius,s=new THREE.Shape();
  s.moveTo(-x+b,-y);s.lineTo(x-b,-y);s.quadraticCurveTo(x,-y,x,-y+b);
  s.lineTo(x,y-t);s.quadraticCurveTo(x,y,x-t,y);
  s.lineTo(-x+t,y);s.quadraticCurveTo(-x,y,-x,y-t);
  s.lineTo(-x,-y+b);s.quadraticCurveTo(-x,-y,-x+b,-y);s.closePath();return s;
}

export function devicePanel(outline:THREE.Shape,depth:number) {
  const geometry=new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:false,curveSegments:12,steps:1});
  geometry.translate(0,0,-depth/2);return geometry;
}

export function deviceScreen(width:number,height:number,radius:number) {
  const geometry=new THREE.ShapeGeometry(deviceOutline(width,height,radius,.004),12);
  const position=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/width+.5,position.getY(i)/height+.5);
  return geometry;
}

/** Rounded screens need their actual extent; ShapeGeometry has no plane parameters. */
export function deviceSurfaceSize(geometry:THREE.BufferGeometry) {
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const {min,max}=geometry.boundingBox!;
  return {width:max.x-min.x,height:max.y-min.y};
}
