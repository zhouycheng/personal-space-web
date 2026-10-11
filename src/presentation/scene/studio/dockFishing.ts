import * as THREE from 'three';
import { islandLeisure,fishingRodPoints } from '../../../config/islandLeisure.ts';
import { islandAppearance } from '../../../config/islandAppearance.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';

/** One rod, cradled on the end piling, with an unbroken line reaching the water. */
export function createDockFishing(p:StudioPrimitives,dock:THREE.Group,metal:THREE.Material,cork:THREE.Material) {
  const group=new THREE.Group();group.name='active-fishing-rod';dock.add(group);
  const curve=new THREE.CatmullRomCurve3(fishingRodPoints.map(point=>new THREE.Vector3(...point)));
  const tube=(points:THREE.Vector3[],radius:number,material=metal)=>p.mesh(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length*3),radius,8,false),material,0,0,0);
  const blank=new THREE.TubeGeometry(curve,96,.014,8,false),a=blank.attributes.position;
  for(let i=0;i<a.count;i++) {
    const t=Math.floor(i/9)/96,center=curve.getPointAt(t),point=new THREE.Vector3().fromBufferAttribute(a,i);
    point.sub(center).multiplyScalar(1-t*.83).add(center);a.setXYZ(i,point.x,point.y,point.z);
  }
  blank.computeVertexNormals();p.mesh(group,blank,metal,0,0,0);
  tube(Array.from({length:9},(_,i)=>curve.getPointAt(i/8*.13)),.025,cork);
  const butt=curve.getPointAt(0);p.mesh(group,new THREE.SphereGeometry(.025,12,8),metal,butt.x,butt.y,butt.z);
  const reelAt=curve.getPointAt(.13).add(new THREE.Vector3(0,-.086,0));
  const spool=p.cylinder(group,.055,.07,reelAt.toArray(),metal);spool.rotation.z=Math.PI/2;
  tube([curve.getPointAt(.13),reelAt],.012);
  tube([reelAt.clone().add(new THREE.Vector3(0,0,.045)),reelAt.clone().add(new THREE.Vector3(-.075,-.04,.05))],.006);
  const linePoints=[reelAt];
  for(const t of [.23,.40,.58,.75,.9,1]) {
    const center=curve.getPointAt(t),tangent=curve.getTangentAt(t),r=.028*(1-t*.72);
    center.y-=r;
    const guide=p.mesh(group,new THREE.TorusGeometry(r,.003,5,16),metal,center.x,center.y,center.z);
    guide.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);linePoints.push(center);
  }
  const tip=linePoints.at(-1)!;
  const water=new THREE.Vector3(tip.x+.11,islandAppearance.seaLevel-.08,tip.z+.015);
  linePoints.push(tip.clone().lerp(water,.45).add(new THREE.Vector3(.025,0,0)),water);
  const line=p.material(0xbcc8bd,.32);line.transparent=true;line.opacity=.62;
  tube(linePoints,.0018,line).castShadow=false;
  const d=islandLeisure.dock,x=d.end-.15,z=fishingRodPoints[1][2];
  p.rounded(group,[.08,.21,.11],[x,d.deck+.44,z],metal,.008);
  const clampAt=curve.getPointAt(.18),clamp=p.mesh(group,new THREE.CylinderGeometry(.037,.037,.22,20,1,true),metal,clampAt.x,clampAt.y,clampAt.z);
  clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangentAt(.18));
  tube([new THREE.Vector3(x,d.deck+.5,z),clampAt],.014);
  group.userData.lineWater=water.toArray();
  return group;
}
