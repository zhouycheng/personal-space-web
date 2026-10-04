import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIslandVegetation } from '../src/presentation/scene/studio/islandVegetation.ts';
import { leafDetailLevel } from '../src/presentation/scene/studio/leafDetails.ts';
import { rockWaterFootprints } from '../src/presentation/scene/studio/islandRocks.ts';

test('vegetation shares fine surface attributes, changes detail without losing plants and owns every level', () => {
  const materials=new Set(),geometries=new Set(),group=createIslandVegetation(materials,geometries);
  const meshes=group.children.filter(mesh=>mesh.name==='plant-leaves');
  assert.ok(meshes.length>30);
  const originals=meshes.map(mesh=>mesh.geometry),triangles=()=>meshes.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0),full=triangles();
  const camera=new THREE.PerspectiveCamera(38,1.6,.1,900);camera.position.set(0,8,25);camera.lookAt(0,1,0);
  group.updateDetail(camera,1350);
  assert.ok(triangles()<full*.65, `${triangles()} versus ${full}`);
  assert.equal(meshes.length,group.children.filter(mesh=>mesh.name==='plant-leaves').length);
  meshes.forEach((mesh,i)=>{
    assert.equal(mesh.geometry.attributes.position,originals[i].attributes.position);
    assert.equal(mesh.geometry.attributes.normal,originals[i].attributes.normal);
    assert.equal(mesh.geometry.attributes.windAnchor,originals[i].attributes.windAnchor);
    assert.ok(geometries.has(mesh.geometry));assert.ok(mesh.castShadow&&mesh.customDepthMaterial);
    assert.ok(mesh.geometry.boundingSphere.radius>0);
    const used=new Set(mesh.geometry.index.array),uv=originals[i].attributes.leafUv;
    for(let vertex=0;vertex<uv.count;vertex++)if(uv.getX(vertex)===0||uv.getX(vertex)===1) {
      assert.ok(used.has(vertex),'every original leaf edge vertex remains in the selected detail level');
    }
  });
  // A camera inside a plant's envelope must return to the original complete geometry.
  camera.position.copy(originals[0].boundingSphere.center);camera.lookAt(0,0,0);group.updateDetail(camera,1350);
  assert.equal(meshes[0].geometry,originals[0]);
  let released=0;for(const resource of [...materials,...geometries]){resource.addEventListener('dispose',()=>released++);resource.dispose();}
  assert.equal(released,materials.size+geometries.size);
});

test('detail hysteresis never retains a level above the pixel error budget', () => {
  const errors=[0,.002,.004];
  assert.equal(leafDetailLevel(errors,110,1),1);
  assert.equal(leafDetailLevel(errors,99,1),2);
  assert.equal(leafDetailLevel(errors,120,2),2);
  assert.equal(leafDetailLevel(errors,126,2),1);
  assert.equal(leafDetailLevel(errors,1000,2),0);
  assert.equal(leafDetailLevel([0,.02,.04],1,0),0,'shadow footprint is also bounded');
});

test('rock influence bounds retain every sample that contributes foam or submerged rock colour', () => {
  for(const surface of [true,false])for(const r of rockWaterFootprints(surface)) {
    for(let i=0;i<128;i++)for(const factor of [.99,1,1.01]) {
      const angle=i/128*Math.PI*2,scale=1+r.limit/r.minimum;
      const x=Math.cos(angle)*r.width*scale*factor,z=Math.sin(angle)*r.depth*scale*factor;
      const worldX=r.c*x-r.s*z,worldZ=r.s*x+r.c*z;
      const actual=(Math.hypot(x/r.width,z/r.depth)-1)*r.minimum;
      if(actual<r.limit)assert.ok(Math.abs(worldX)<r.extentX&&Math.abs(worldZ)<r.extentZ);
    }
  }
});
