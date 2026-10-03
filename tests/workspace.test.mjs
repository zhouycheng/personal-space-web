import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createStudioFurniture } from '../src/presentation/scene/studio/studioFurniture.ts';
import { createStudioDevices } from '../src/presentation/scene/studio/studioDevices.ts';
import { createStudioFiles } from '../src/presentation/scene/studio/studioFiles.ts';
import { canopyOpacity } from '../src/animation/studio/canopyVisibility.ts';
import { workspaceAppearance as layout } from '../src/config/workspaceAppearance.ts';
import { createWorkspaceMaterials } from '../src/presentation/scene/studio/workspaceMaterials.ts';
import { canopySurface } from '../src/animation/studio/canopySurface.ts';
import { chairTurn,CHAIR_ROCKER_RADIUS,CHAIR_TURN_MS } from '../src/animation/studio/chairMotion.ts';

test('roof leaves frontal views open, clears crossing and close cameras, and restores after return',()=>{
  assert.equal(canopyOpacity([0,2,8],[0,1.5,-1]),1);
  assert.equal(canopyOpacity([0,7,5],[0,1.5,-1]),0);
  assert.equal(canopyOpacity([0,3.6,0],[0,1.5,-1]),0);
  assert.equal(canopyOpacity([8,7,0],[8,1,0]),1);
  assert.equal(canopyOpacity([0,2,8],[0,1.5,-1]),1);
  assert.equal(canopyOpacity([0,2,8],[0,2,-1]),1);
});

test('workspace textures and materials share one scene owner and dispose without crossing scenes',()=>{
  const materials=new Set(),textures=new Set(),first=createWorkspaceMaterials(materials,textures);
  assert.equal(createWorkspaceMaterials(materials,textures),first);
  assert.notEqual(createWorkspaceMaterials(new Set(),new Set()).canvas,first.canvas);
  assert.equal(textures.size,4);assert.equal(materials.size,4);
  const roof=first.canvas.clone();roof.opacity=0;
  assert.equal(first.canvas.opacity,1,'roof fading cannot fade chair fabric');
  assert.equal(roof.map,first.canvas.map);
  let disposed=0;for(const item of [...materials,...textures]){item.addEventListener('dispose',()=>disposed++);item.dispose();}
  assert.equal(disposed,8);roof.dispose();
});

test('furniture keeps diary in the moving drawer, leaves device anchors fixed, and puts files beside the desk',()=>{
  const before=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  try {
    const renderer={capabilities:{getMaxAnisotropy:()=>1}};
    const p=createStudioPrimitives(renderer,room,materials,geometries,textures);
    const furniture=createStudioFurniture(room,p,materials,textures);
    assert.equal(furniture.diary.parent,furniture.drawers[0].group);
    assert.equal(furniture.drawers.length,3);
    assert.ok(furniture.drawers.every(d=>d.group.position.z===layout.drawerFront));
    assert.equal(furniture.chairSeat.children.filter(child=>child.name==='curved-rocker').length,2);
    assert.ok(furniture.chairSeat.children.some(child=>child.name==='solid-canvas-back'));
    const pose=chairTurn(550);furniture.chairSeat.rotation.x=pose.angle;furniture.chairSeat.position.set(0,pose.y,pose.z);
    const devices=createStudioDevices(p,renderer,materials,textures,'Justin OS');
    createStudioFiles(p,[],materials,geometries,textures);room.updateMatrixWorld(true);
    const tablet=devices.canvasSurface.getWorldPosition(new THREE.Vector3());
    assert.ok(tablet.distanceTo(new THREE.Vector3(1.04,1.474,-1.1))<1e-10);
    const computer=room.children.find(child=>child.userData.action==='computer');
    assert.deepEqual(computer.scale.toArray(),[.6,.6,.6]);
    assert.ok(computer.position.distanceTo(new THREE.Vector3(-.08,.572,-.52))<1e-10);
    const crate=room.children.find(child=>child.userData.action==='works');
    const box=new THREE.Box3().setFromObject(crate);
    assert.ok(box.max.x < -1.75,'crate clears cabinet and drawer travel');
    assert.ok(box.min.y>=-.01&&box.min.y<.03,'crate rests on sand');
    room.traverse(object=>{if(object.isMesh){assert.ok(geometries.has(object.geometry));assert.ok(materials.has(object.material));}});
  } finally {
    globalThis.document=before;
    for(const resource of [...materials,...geometries,...textures])resource.dispose();
  }
});

test('rocker rolling contact stays grounded and sail corners stay pinned under the shared breeze',()=>{
  for(let elapsed=0;elapsed<=CHAIR_TURN_MS;elapsed+=50) {
    const {angle,y,z}=chairTurn(elapsed),R=CHAIR_ROCKER_RADIUS;
    const contact=new THREE.Vector3(0,R-R*Math.cos(angle),R*Math.sin(angle));
    contact.applyAxisAngle(new THREE.Vector3(1,0,0),angle).add(new THREE.Vector3(0,y,z));
    assert.ok(Math.abs(contact.y)<1e-10);assert.ok(Math.abs(contact.z-R*angle)<1e-10);
  }
  for(const u of [0,1])for(const v of [0,1])for(const t of [0,1,5,20]) {
    const p=canopySurface(u,v,t),rest=canopySurface(u,v,0);
    assert.ok(Math.hypot(p.x-rest.x,p.y-rest.y,p.z-rest.z)<1e-10);
  }
  assert.notEqual(canopySurface(.5,.5,2).y,canopySurface(.5,.5,3).y);
  for(let t=0;t<20;t+=.1)assert.ok(Math.abs(canopySurface(.5,.5,t).y-canopySurface(.5,.5,0).y)<.12);
});
