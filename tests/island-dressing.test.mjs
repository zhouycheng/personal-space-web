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

test('decorations are grounded, batched, unpickable and scene-owned; existing framing contains them',()=>{
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const p=createStudioPrimitives({},room,materials,geometries,textures);
  const dressing=createIslandDressing(p,materials,geometries,textures);
  assert.equal(room.children.length,0,'no ornaments in furniture picking group');
  const meshes=dressing.group.children.filter(object=>object.isMesh);
  assert.ok(meshes.filter(mesh=>!mesh.material.transparent).length<=16,'opaque ornaments remain batched by material');
  assert.equal(meshes.filter(mesh=>mesh.material.transparent).length,3,'three closed, thick glass chimneys stay independently sortable');
  const lamps=dressing.group.children.filter(object=>object.isLight);assert.equal(lamps.length,3);
  for(const placement of dressing.group.userData.placements)
    assert.ok(Math.abs(placement.bounds.min.y-terrainHeight(placement.x,placement.z))<1e-8);
  dressing.group.traverse(object=>{
    assert.equal(object.userData.action,undefined);
    if(object.isLight)assert.equal(object.castShadow,false,'local lantern light adds no shadow pass');
    if(object.isMesh){assert.ok(geometries.has(object.geometry));assert.ok(materials.has(object.material));}
  });
  const glowing=meshes.find(mesh=>mesh.material.emissive?.getHex()===0xffb45e).material;
  dressing.setLighting(1);const day=glowing.emissiveIntensity;dressing.setLighting(0);assert.ok(glowing.emissiveIntensity>day);
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
