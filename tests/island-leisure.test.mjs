import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createIslandLeisure } from '../src/presentation/scene/studio/islandLeisure.ts';
import { coastRadius,shoreRadius } from '../src/config/islandTerrain.ts';
import { islandLeisure } from '../src/config/islandLeisure.ts';
import { surfaceOrbit } from '../src/animation/studio/studioMotion.ts';
import { islandAppearance } from '../src/config/islandAppearance.ts';

test('expanded beach supports the fire and the dock starts on land and ends in water',()=>{
  assert.ok(shoreRadius(Math.PI/2)>1.25);assert.ok(shoreRadius(0)>1.1);
  const {campfire:f,dock:d}=islandLeisure;
  assert.ok(coastRadius(f.x,f.z+f.radius)<.9);
  assert.ok(coastRadius(d.start,d.z)<1);assert.ok(coastRadius(d.end,d.z)>1.1);
});
test('beach additions are unpickable, own all resources and use the shared animation time',()=>{
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const leisure=createIslandLeisure(createStudioPrimitives({},room,materials,geometries,textures),materials,textures,geometries);
  assert.equal(room.children.length,0);
  const rods=[];leisure.group.traverse(object=>{if(object.name==='active-fishing-rod')rods.push(object);});
  assert.equal(rods.length,1,'one rod is set for fishing at the dock end');
  const [lineX,lineY,lineZ]=rods[0].userData.lineWater;
  assert.ok(lineX>islandLeisure.dock.end&&lineY<islandAppearance.seaLevel);
  assert.ok(lineZ<islandLeisure.dock.z,'the line stays on the seaward side, clear of the boat');
  let flame;leisure.group.traverse(o=>{assert.equal(o.userData.action,undefined);if(o.isMesh){assert.ok(materials.has(o.material));assert.ok(geometries.has(o.geometry));if(o.material.uniforms?.time)flame=o;}});
  leisure.setWind(1.5);assert.equal(flame.material.uniforms.time.value,1.5);
  leisure.setWind(1.5);assert.equal(flame.material.uniforms.time.value,1.5);
  let released=0;for(const r of [...materials,...geometries,...textures]){r.addEventListener('dispose',()=>released++);r.dispose();}
  assert.equal(released,materials.size+geometries.size+textures.size);
});
test('device alignment from behind circles the workspace without crossing its center',()=>{
  for(let i=0;i<=100;i++){const p=surfaceOrbit([0,8,-20],[0,3,10],[0,1,0],i/100);assert.ok(Math.hypot(p[0],p[2])>=10-1e-10);}
});
