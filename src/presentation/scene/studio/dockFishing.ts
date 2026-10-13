import * as THREE from 'three';
import { islandLeisure,fishingRodPoints } from '../../../config/islandLeisure.ts';
import { islandAppearance } from '../../../config/islandAppearance.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';
import type { FishingState } from '../../../contracts/fishing.ts';
import { fishingTiming } from '../../../config/fishing.ts';
import { oceanHeight } from '../../../animation/studio/oceanSurface.ts';
import { createMarineAnimal } from './marineGeometry.ts';
import { underwaterLayer } from './marineEnvironment.ts';

/** One rod, cradled on the end piling, with an unbroken line reaching the water. */
export function createDockFishing(p:StudioPrimitives,dock:THREE.Group,metal:THREE.Material,cork:THREE.Material) {
  const group=new THREE.Group();group.name='active-fishing-rod';dock.add(group);
  group.userData.action='fishing';group.userData.label='去码头钓鱼';
  const rod=new THREE.Group();rod.name='fishing-rod';group.add(rod);
  const curve=new THREE.CatmullRomCurve3(fishingRodPoints.map(point=>new THREE.Vector3(...point)));
  const tube=(points:THREE.Vector3[],radius:number,material=metal,parent:THREE.Object3D=rod)=>p.mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length*3),radius,8,false),material,0,0,0);
  const blank=new THREE.TubeGeometry(curve,96,.014,8,false),a=blank.attributes.position;
  for(let i=0;i<a.count;i++) {
    const t=Math.floor(i/9)/96,center=curve.getPointAt(t),point=new THREE.Vector3().fromBufferAttribute(a,i);
    point.sub(center).multiplyScalar(1-t*.83).add(center);a.setXYZ(i,point.x,point.y,point.z);
  }
  blank.computeVertexNormals();p.mesh(rod,blank,metal,0,0,0);
  tube(Array.from({length:9},(_,i)=>curve.getPointAt(i/8*.13)),.025,cork);
  const butt=curve.getPointAt(0);p.mesh(rod,new THREE.SphereGeometry(.025,12,8),metal,butt.x,butt.y,butt.z);
  const reelAt=curve.getPointAt(.13).add(new THREE.Vector3(0,-.086,0));
  const spool=p.mesh(rod,new THREE.CylinderGeometry(.055,.055,.07,16),metal,reelAt.x,reelAt.y,reelAt.z);spool.rotation.z=Math.PI/2;
  tube([curve.getPointAt(.13),reelAt],.012);
  tube([reelAt.clone().add(new THREE.Vector3(0,0,.045)),reelAt.clone().add(new THREE.Vector3(-.075,-.04,.05))],.006);
  const linePoints=[reelAt];
  for(const t of [.23,.40,.58,.75,.9,1]) {
    const center=curve.getPointAt(t),tangent=curve.getTangentAt(t),r=.028*(1-t*.72);
    center.y-=r;
    const guide=p.mesh(rod,new THREE.TorusGeometry(r,.003,5,16),metal,center.x,center.y,center.z);
    guide.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);linePoints.push(center);
  }
  const tip=linePoints.at(-1)!;
  const water=new THREE.Vector3(tip.x+.11,islandAppearance.seaLevel-.08,tip.z+.015);
  const line=p.material(0xbcc8bd,.32);line.transparent=true;line.opacity=.62;
  tube(linePoints,.0018,line).castShadow=false;
  const restingLine=tube([tip,tip.clone().lerp(water,.45).add(new THREE.Vector3(.025,0,0)),water],.0018,line,group);restingLine.castShadow=false;
  const d=islandLeisure.dock,x=d.end-.15,z=fishingRodPoints[1][2];
  p.rounded(group,[.08,.21,.11],[x,d.deck+.44,z],metal,.008);
  const clampAt=curve.getPointAt(.18),clamp=p.mesh(group,new THREE.CylinderGeometry(.037,.037,.22,20,1,true),metal,clampAt.x,clampAt.y,clampAt.z);
  clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangentAt(.18));
  tube([new THREE.Vector3(x,d.deck+.5,z),clampAt],.014,metal,group);
  group.userData.lineWater=water.toArray();
  const proxyMaterial=p.material(0);proxyMaterial.visible=false;
  for(const t of [.25,.58,.86]) {
    const point=curve.getPointAt(t),proxy=p.box(group,[.9,.22,.3],point.toArray(),proxyMaterial);
    proxy.castShadow=proxy.receiveShadow=false;proxy.userData.excludeZoom=true;
  }
  rod.position.copy(butt);rod.children.forEach(child=>child.position.sub(butt));rod.updateMatrixWorld(true);
  const vertex=new THREE.Vector3(),length=tip.x-butt.x;
  const bendMeshes=rod.children.filter((child):child is THREE.Mesh=>child instanceof THREE.Mesh).map(mesh=>{
    mesh.updateMatrix();
    const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute,rest=Float32Array.from(position.array);
    const weights=Array.from({length:position.count},(_,i)=>Math.max(0,vertex.fromBufferAttribute(position,i).applyMatrix4(mesh.matrix).x/length)**2);
    const direction=new THREE.Vector3(0,-1,0).transformDirection(mesh.matrix.clone().invert());
    position.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
    return {position,rest,weights,direction};
  });
  const tackle=new THREE.Group();tackle.name='fishing-tackle';group.add(tackle);tackle.visible=false;
  const cream=p.material(0xfff3d3,.38),red=p.material(0xb85239,.4);
  cream.emissive.set(0x5b5035);cream.emissiveIntensity=.3;
  const float=new THREE.Group();float.name='fishing-float';tackle.add(float);
  p.mesh(float,new THREE.SphereGeometry(.085,16,12),cream,0,0,0).scale.set(.7,1.2,.7);
  p.cylinder(float,.018,.19,[0,.16,0],red);
  p.mesh(float,new THREE.SphereGeometry(.029,12,8),red,0,.27,0);
  const fishMaterial=p.material(0xffffff,.48);fishMaterial.vertexColors=true;fishMaterial.side=THREE.DoubleSide;
  const fish=p.mesh(tackle,createMarineAnimal('school'),fishMaterial,0,0,0);fish.name='fishing-catch';fish.layers.enable(underwaterLayer);
  const rippleGeometry=new THREE.RingGeometry(.92,1,48),ripples=Array.from({length:2},()=>{
    const material=p.material(0xdbf3e7,.4);material.transparent=true;material.depthWrite=false;material.opacity=0;material.side=THREE.DoubleSide;
    const mesh=p.mesh(tackle,rippleGeometry,material,0,0,0);mesh.rotation.x=-Math.PI/2;return mesh;
  });
  const liveGeometry=new THREE.TubeGeometry(new THREE.LineCurve3(tip,water),24,.003,5,false);
  const liveLine=p.mesh(tackle,liveGeometry,line,0,0,0);liveLine.frustumCulled=false;
  const linePosition=liveGeometry.getAttribute('position') as THREE.BufferAttribute;linePosition.setUsage(THREE.DynamicDrawUsage);
  tackle.traverse(object=>{object.userData.excludeZoom=true;if(object instanceof THREE.Mesh)object.castShadow=object.receiveShadow=false;});
  const castPoint=water.clone().add(new THREE.Vector3(1.45,0,-.38));
  const endPoint=new THREE.Vector3(),tipPoint=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),along=new THREE.Vector3(),side=new THREE.Vector3(),normal=new THREE.Vector3();
  let lastBend=NaN;
  const ease=(t:number)=>{const v=THREE.MathUtils.clamp(t,0,1);return v*v*(3-2*v);};
  function update(state:FishingState,waterTime:number,animate:boolean) {
    const {phase,elapsed}=state,cast=phase==='casting'?elapsed/fishingTiming.casting:1;
    const reeling=phase==='reeling'?(animate?ease(elapsed/fishingTiming.reeling):1):phase==='caught'||phase==='releasing'?1:0;
    const release=phase==='releasing'?(animate?ease(elapsed/fishingTiming.releasing):1):0;
    const active=['casting','waiting','nibble','bite','reeling','caught','releasing'].includes(phase);
    tackle.visible=active;restingLine.visible=!active;
    const tug=phase==='nibble'?(animate?Math.sin(elapsed*12)**2:.5):phase==='bite'?1:0;
    const bend=animate?phase==='casting'?.16*Math.sin(cast*Math.PI):.08*tug+.27*reeling*(1-release):phase==='bite'?.08:0;
    rod.rotation.z=animate?(phase==='casting'?Math.sin(cast*Math.PI)*.3:reeling*.4*(1-release)):0;
    if(bend!==lastBend){
      for(const {position,rest,weights,direction} of bendMeshes){
        for(let i=0;i<position.count;i++){const offset=bend*weights[i];position.setXYZ(i,rest[i*3]+direction.x*offset,rest[i*3+1]+direction.y*offset,rest[i*3+2]+direction.z*offset);}
        position.needsUpdate=true;
      }lastBend=bend;
    }
    if(!active)return;
    rod.updateMatrixWorld(true);tipPoint.copy(tip).sub(butt);tipPoint.y-=bend;tipPoint.applyMatrix4(rod.matrixWorld);
    const height=oceanHeight(castPoint.x,castPoint.z,waterTime);
    float.visible=!['caught','releasing'].includes(phase);
    float.position.copy(castPoint);float.position.y=height+.035-(phase==='bite'?.32:.1*tug);
    if(phase==='casting'&&animate){float.position.lerpVectors(tipPoint,float.position,ease(cast));float.position.y+=Math.sin(cast*Math.PI)*1.1;}
    if(reeling>0)float.position.lerp(tipPoint.clone().add(new THREE.Vector3(-.25,-.6,0)),reeling);
    float.rotation.z=animate?.12*tug:0;
    fish.visible=phase!=='casting';fish.scale.setScalar(state.length/28);
    const approach=phase==='waiting'&&animate?1-ease(elapsed/state.waitSeconds):0;
    fish.position.set(castPoint.x+approach*1.8,height-.28,castPoint.z+.07+approach*.65);
    fish.rotation.set(0,Math.PI+(animate?.1*Math.sin(elapsed*6):0),0);
    if(reeling>0){
      fish.position.lerp(tipPoint.clone().add(new THREE.Vector3(-.35,-.7,0)),reeling);
      fish.rotation.z=Math.PI/2*reeling;
    }
    if(phase==='releasing'){
      fish.position.lerp(new THREE.Vector3(castPoint.x+.9,height-.5,castPoint.z-.4),animate?release:1);
      fish.rotation.z=Math.PI/2*(1-release);
    }
    endPoint.copy(reeling>0?fish.position:float.position);
    if(reeling>0)endPoint.y+=state.length/28*.22;
    liveLine.visible=phase!=='releasing';
    along.subVectors(endPoint,tipPoint).normalize();side.crossVectors(along,up);
    if(side.lengthSq()<.0001)side.set(1,0,0);else side.normalize();normal.crossVectors(side,along).normalize();
    for(let i=0;i<=24;i++)for(let j=0;j<=5;j++){
      const t=i/24,a=j/5*Math.PI*2,index=i*6+j;
      vertex.lerpVectors(tipPoint,endPoint,t).addScaledVector(side,Math.cos(a)*.003).addScaledVector(normal,Math.sin(a)*.003);
      vertex.y-=Math.sin(t*Math.PI)*.055*(1-reeling);linePosition.setXYZ(index,vertex.x,vertex.y,vertex.z);
    }
    linePosition.needsUpdate=true;
    ripples.forEach((ripple,i)=>{
      const pulse=animate?(elapsed*.9+i*.5)%1:.35+i*.3;
      ripple.visible=['waiting','nibble','bite','reeling','releasing'].includes(phase);
      ripple.position.set(castPoint.x,height+.014+i*.003,castPoint.z);
      ripple.scale.setScalar(.07+pulse*(phase==='bite'||phase==='releasing'?.65:.35));
      (ripple.material as THREE.MeshStandardMaterial).opacity=(1-pulse)*(phase==='bite'?.7:.35);
    });
  }
  return {group,update};
}
