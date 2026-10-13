import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dressingFootprints,dressingRocks } from '../src/config/islandDressing.ts';
import { workspaceAppearance } from '../src/config/workspaceAppearance.ts';
import { terrainHeight,rockBase } from '../src/config/islandTerrain.ts';
import { createIslandDressing } from '../src/presentation/scene/studio/islandDressing.ts';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { islandViewDistance } from '../src/animation/studio/islandFraming.ts';
import { islandAppearance } from '../src/config/islandAppearance.ts';

const segmentDistance=(x,z,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
};
test('new ground ornaments clear guy ropes, furniture, drawer travel and the front approach',()=>{
  const roof=workspaceAppearance.canopy;
  for(const item of dressingFootprints) {
    for(const x of [roof.left,roof.right])for(const z of [roof.back,roof.front]) {
      const peg=[x+(x<0?-.52:.52),z+(z===roof.front?.32:-.6)];
      assert.ok(segmentDistance(item.x,item.z,[x,z],peg)-item.radius>=.15,`guy rope near ${item.x},${item.z}`);
    }
    for(const [x0,x1,z0,z1] of [[-1.8,1.8,-2.05,-.55],[-1.62,-.89,-1.87,.2],[-.85,.55,-.3,.96],[-.8,.8,.96,3.5]]) {
      const gap=Math.hypot(Math.max(x0-item.x,0,item.x-x1),Math.max(z0-item.z,0,item.z-z1))-item.radius;
      assert.ok(gap>=.25,`furniture clearance near ${item.x},${item.z}`);
    }
  }
  for(const rock of dressingRocks)assert.ok(Math.abs(terrainHeight(rock.x,rock.z)-rockBase(rock)-rock.height/3)<1e-10);
});

test('decorations are grounded and scene-owned; the firewood rack keeps its explicit picking action',()=>{
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const p=createStudioPrimitives({},room,materials,geometries,textures);
  const dressing=createIslandDressing(p,materials,geometries,textures);
  assert.equal(room.children.length,0,'no ornaments in furniture picking group');
  const meshes=dressing.group.children.filter(object=>object.isMesh);
  const opaque=meshes.filter(mesh=>!mesh.material.transparent);
  assert.equal(opaque.length,new Set(opaque.map(mesh=>mesh.material)).size,'one opaque draw per material');
  assert.ok(opaque.length<=17,'living cloth, firewood and stepping stones share seventeen material batches');
  assert.equal(meshes.filter(mesh=>mesh.material.transparent).length,6,'three flame volumes and three glass chimneys stay independently sortable');
  assert.equal(dressing.cabinet.parent,null,'file cabinet remains separate for the furniture picking tree');
  const wood=dressing.cabinet.children.find(mesh=>mesh.material.vertexColors);
  assert.ok(wood.geometry.getAttribute('color'),'interactive cabinet retains baked wood shading');
  assert.ok(meshes.some(mesh=>mesh.material===wood.material),'cabinet keeps the original shared timber material');
  const cabinetBounds=new THREE.Box3().setFromObject(dressing.cabinet);
  assert.ok(cabinetBounds.min.x>1.8,'cabinet clears the desk');
  assert.ok(cabinetBounds.max.z>-.7,'cabinet front reaches beyond the desk front');
  const lamps=dressing.group.children.filter(object=>object.isLight);assert.equal(lamps.length,3);
  assert.equal(dressing.firewood.group.parent,dressing.group);
  assert.equal(dressing.firewood.group.userData.action,'firewood');
  for(const placement of dressing.group.userData.placements)
    assert.ok(Math.abs(placement.bounds.min.y-terrainHeight(placement.x,placement.z))<1e-8);
  for(const root of [dressing.group,dressing.cabinet])root.traverse(object=>{
    assert.equal(object.userData.action,object===dressing.firewood.group?'firewood':undefined);
    if(object.isLight)assert.equal(object.castShadow,false,'local lantern light adds no shadow pass');
    if(object.isMesh){assert.ok(geometries.has(object.geometry));assert.ok(materials.has(object.material));}
  });
  const flames=meshes.filter(mesh=>mesh.name==='lantern-flame');assert.equal(flames.length,3);
  assert.equal(new Set(flames.map(mesh=>mesh.material)).size,1);
  for(const flame of flames){assert.equal(flame.castShadow,false);assert.equal(flame.material.depthWrite,false);assert.ok(flame.position.y>.2);}
  dressing.setWind(1.5);assert.ok(flames.every(flame=>flame.material.uniforms.time.value===1.5));
  dressing.setWind(1.5);assert.ok(flames.every(flame=>flame.material.uniforms.time.value===1.5),'paused scene time freezes all wick flames');
  dressing.setWind(2);assert.ok(flames.every(flame=>flame.material.uniforms.time.value===2));
  dressing.setLighting(1);const day=lamps[0].intensity;dressing.setLighting(0);assert.ok(lamps.every(lamp=>lamp.intensity>day));
  for(const aspect of [390/844,1440/900])for(const angle of [-1.22,-.48,1.22])for(const elevation of [.2,.55,1]) {
    const camera=new THREE.PerspectiveCamera(38,aspect,.1,900),focus=new THREE.Vector3(0,.35,islandAppearance.centerZ);
    camera.position.copy(focus).add(new THREE.Vector3(Math.sin(angle),Math.sin(elevation),Math.cos(angle)).multiplyScalar(islandViewDistance(aspect,angle,elevation)));
    camera.lookAt(focus);camera.updateMatrixWorld();
    for(const mesh of meshes) {
      const points=mesh.geometry.attributes.position;
      for(let i=0;i<points.count;i+=17){const v=new THREE.Vector3().fromBufferAttribute(points,i).add(mesh.position).project(camera);assert.ok(Math.abs(v.x)<=.801&&Math.abs(v.y)<=.761);}
    }
  }
  let released=0;const resources=[...materials,...geometries,...textures];
  for(const resource of resources){resource.addEventListener('dispose',()=>released++);resource.dispose();}
  assert.equal(released,resources.length);
});
