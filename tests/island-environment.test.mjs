import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { islandAppearance as island } from '../src/config/islandAppearance.ts';
import { islandViewDistance } from '../src/animation/studio/islandFraming.ts';
import { createIslandGeometry, createIslandEnvironment, islandHeight, shoreRadius } from '../src/presentation/scene/studio/islandEnvironment.ts';
import { studioLighting } from '../src/config/studioTime.ts';
import { terrainHeight, islandRocks, rockBase } from '../src/config/islandTerrain.ts';
import { createRockGeometry } from '../src/presentation/scene/studio/islandRocks.ts';
import { createIslandVegetation } from '../src/presentation/scene/studio/islandVegetation.ts';

test('terrain keeps the furniture and approach level, raises the back, and joins the shared shoreline',()=>{
  for(let x=-2;x<=2;x+=.25)for(let z=-2.3;z<=1.5;z+=.25)
    assert.ok(Math.abs(terrainHeight(x,z))<1e-10,'furniture and chair sweep remain level');
  assert.ok(terrainHeight(-2.8,-4.7)>.25);
  for(let i=0;i<128;i++) {
    const angle=i/128*Math.PI*2,r=shoreRadius(angle);
    assert.ok(Math.abs(terrainHeight(Math.cos(angle)*island.radiusX*r,Math.sin(angle)*island.radiusZ*r+island.centerZ)-island.seaLevel)<1e-8);
  }
  for(const rock of islandRocks) {
    assert.ok(rockBase(rock)<terrainHeight(rock.x,rock.z),'rock foot buried');
    assert.ok(Math.hypot(rock.x,rock.z)>3,'central interaction area clear');
  }
});

test('island supports the existing desk and chair sweep at y=0 and meets sea at its shared outline', () => {
  for (const [x,z] of [[-1.75,-2.05],[1.75,-2.05],[-1.75,-.55],[1.75,-.55],[-1,.18],[.6,.18],[-.2,.98]]) {
    const nx=x/island.radiusX, nz=(z-island.centerZ)/island.radiusZ;
    const radius=Math.hypot(nx,nz)/shoreRadius(Math.atan2(nz,nx));
    assert.ok(Math.abs(islandHeight(radius))<1e-10);
  }
  assert.equal(islandHeight(1),island.seaLevel);
  assert.ok(islandHeight(1.4)<island.seaLevel);
  const geometry=createIslandGeometry();
  const normals=geometry.attributes.normal;
  for(let i=0;i<normals.count;i++) {
    assert.ok(Number.isFinite(normals.getY(i)));
    assert.ok(normals.getY(i)>=0,'triangles face up');
  }
  geometry.dispose();
});

test('default framing contains the shoreline and furniture across viewport and allowed orbit angles', () => {
  const rocks=createRockGeometry(),vertices=rocks.attributes.position;
  const plantMaterials=new Set(),plantGeometries=new Set();
  const plants=createIslandVegetation(plantMaterials,plantGeometries);
  for(const aspect of [.3,390/844,1,1440/900,3]) for(const angle of [-Math.PI,-1.22,-.48,1.22,Math.PI/2,2.7]) for(const elevation of [.2,.55,1]) {
    const distance=islandViewDistance(aspect,angle,elevation);
    const focus=new THREE.Vector3(0,.35,island.centerZ);
    const camera=new THREE.PerspectiveCamera(38,aspect,.1,900);
    camera.position.copy(focus).add(new THREE.Vector3(Math.sin(angle),Math.sin(elevation),Math.cos(angle)).multiplyScalar(distance));
    camera.lookAt(focus);camera.updateMatrixWorld();
    const check=point=>{
      const projected=point.project(camera);
      assert.ok(Math.abs(projected.x)<=.801 && Math.abs(projected.y)<=.761,`out of frame: ${projected.toArray()}`);
      assert.ok(projected.z<1);
    };
    for(let i=0;i<128;i++) {
      const t=i/128*Math.PI*2,r=shoreRadius(t);
      check(new THREE.Vector3(Math.cos(t)*island.radiusX*r,island.seaLevel,Math.sin(t)*island.radiusZ*r+island.centerZ));
    }
    check(new THREE.Vector3(1.53,2.5,-1.86));
    for(let i=0;i<vertices.count;i+=23)check(new THREE.Vector3().fromBufferAttribute(vertices,i));
    for(const plant of plants.children) {
      const positions=plant.geometry.attributes.position;
      for(let i=0;i<positions.count;i+=97)check(new THREE.Vector3().fromBufferAttribute(positions,i));
    }
  }
  rocks.dispose();
  for(const resource of [...plantMaterials,...plantGeometries])resource.dispose();
});

test('water pauses without catching up hidden time; environment resources belong to the scene release sets', () => {
  const scene=new THREE.Scene(), materials=new Set(), geometries=new Set();
  const environment=createIslandEnvironment(scene,materials,geometries);
  const water=environment.group.getObjectByName('island-water');
  assert.equal(materials.size,8);
  environment.group.traverse(object=>{if(object.isMesh)assert.ok(geometries.has(object.geometry));});
  const resourceCount=materials.size+geometries.size;
  assert.equal(environment.tick(1000,true),true);
  environment.tick(1020,true);
  assert.equal(water.material.uniforms.time.value,.02);
  assert.equal(environment.tick(2000,false),false);
  environment.tick(200000,true);
  assert.equal(water.material.uniforms.time.value,.02);
  environment.pause();environment.tick(400000,true);
  assert.equal(water.material.uniforms.time.value,.02);
  environment.setLighting(studioLighting(new Date(Date.UTC(2026,9,3,15))));
  assert.equal(water.material.uniforms.daylight.value,0);
  const sky=environment.group.getObjectByName('island-sky');
  assert.equal(sky.material.uniforms.sunDirection,water.material.uniforms.sunDirection);
  assert.equal(sky.material.uniforms.horizon,water.material.uniforms.horizon);
  let released=0;
  for(const resource of [...materials,...geometries]) {
    resource.addEventListener('dispose',()=>released++);resource.dispose();
  }
  assert.equal(released,resourceCount);
  assert.ok(environment.group.children.every(object=>!object.userData.action));
});
