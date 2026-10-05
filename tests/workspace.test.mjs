import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createStudioFurniture } from '../src/presentation/scene/studio/studioFurniture.ts';
import { createStudioDevices } from '../src/presentation/scene/studio/studioDevices.ts';
import { createStudioFiles } from '../src/presentation/scene/studio/studioFiles.ts';
import { canopyDistanceOpacity,fadeCanopyOpacity } from '../src/animation/studio/canopyVisibility.ts';
import { workspaceAppearance as layout } from '../src/config/workspaceAppearance.ts';
import { createWorkspaceMaterials } from '../src/presentation/scene/studio/workspaceMaterials.ts';
import { canopySurface } from '../src/animation/studio/canopySurface.ts';
import { createChairRocking,CHAIR_ROCKER_RADIUS } from '../src/animation/studio/chairMotion.ts';

test('roof clears close desktop and eye-level cameras and restores at island distance',()=>{
  for(const camera of [[0,2,1],[0,7,0],[0,1.5,-4],[4,2,0]])
    assert.equal(canopyDistanceOpacity(camera),0);
  for(const camera of [[0,2,18],[18,2,0],[0,2,-18]])
    assert.equal(canopyDistanceOpacity(camera),1);
});

test('canopy anticipates an approaching camera and opacity reverses continuously',()=>{
  const samples=Array.from({length:81},(_,i)=>canopyDistanceOpacity([0,2,12-i*.075]));
  assert.ok(samples.some(value=>value>0&&value<1));
  for(let i=1;i<samples.length;i++)assert.ok(samples[i]<=samples[i-1]&&samples[i-1]-samples[i]<.04);
  let opacity=1;
  for(let i=0;i<30;i++){
    const next=fadeCanopyOpacity(opacity,0,16);
    assert.ok(next<opacity&&opacity-next<.1);opacity=next;
  }
  assert.ok(opacity<.08);
  const restored=fadeCanopyOpacity(opacity,1,16);
  assert.ok(restored>opacity&&restored-opacity<.06);
  assert.equal(fadeCanopyOpacity(opacity,1,0),opacity,'Paused time must not advance a fade');
  assert.equal(fadeCanopyOpacity(1,0,16,true),0);
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

test('furniture keeps diary on the desktop, leaves device anchors fixed, and puts files beside the desk',()=>{
  const before=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  try {
    const renderer={capabilities:{getMaxAnisotropy:()=>1}};
    const p=createStudioPrimitives(renderer,room,materials,geometries,textures);
    const furniture=createStudioFurniture(room,p,materials,textures);
    assert.equal(furniture.diary.parent,room);
    assert.deepEqual(furniture.diary.position.toArray(),[layout.diary.x,layout.tabletop+layout.diary.lift,layout.diary.z]);
    assert.equal(furniture.drawers.length,3);
    assert.ok(furniture.drawers.every(d=>d.group.position.z===layout.drawerFront));
    assert.equal(furniture.chairSeat.children.filter(child=>child.name==='curved-rocker').length,2);
    assert.ok(furniture.chairSeat.children.some(child=>child.name==='solid-canvas-back'));
    const motion=createChairRocking();motion.push();const pose=motion.step(.05);furniture.chairSeat.rotation.x=pose.angle;furniture.chairSeat.position.set(0,pose.y,pose.z);
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
  const motion=createChairRocking();motion.push();
  for(let elapsed=0;elapsed<=10000;elapsed+=50) {
    const {angle,y,z}=motion.step(.05),R=CHAIR_ROCKER_RADIUS;
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
