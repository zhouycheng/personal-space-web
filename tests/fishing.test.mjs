import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFishingController } from '../src/application/studio/fishing.ts';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createDockFishing } from '../src/presentation/scene/studio/dockFishing.ts';
import { createStudioPicker } from '../src/presentation/interaction/studio/pickObject.ts';

function game() {
  let now=0;const changes=[];
  const fishing=createFishingController(state=>changes.push(state.phase),()=>.5);
  const advance=seconds=>{fishing.tick(now,true);now+=seconds*1000;fishing.tick(now,true);};
  fishing.start();advance(.9);
  return {fishing,advance,changes};
}

test('a full fishing round casts, nibbles, bites, reels and releases before another cast',()=>{
  const {fishing,advance,changes}=game();assert.equal(fishing.view().phase,'ready');
  fishing.interact();fishing.interact();assert.equal(fishing.view().phase,'casting');
  advance(1.1);assert.equal(fishing.view().phase,'waiting');
  advance(7);assert.equal(fishing.view().phase,'nibble');
  advance(1.4);assert.equal(fishing.view().phase,'bite');
  advance(2);fishing.interact();assert.equal(fishing.view().phase,'reeling');
  advance(1.1);assert.equal(fishing.view().phase,'caught');assert.equal(fishing.view().length,28);
  fishing.interact();advance(1.2);assert.equal(fishing.view().phase,'ready');
  assert.deepEqual(changes,['entering','ready','casting','waiting','nibble','bite','reeling','caught','releasing','ready']);
});

test('early and late reels explain the miss and allow a fresh round',()=>{
  for(const attempt of ['waiting','nibble','late']) {
    const {fishing,advance}=game();fishing.interact();advance(1.1);
    if(attempt!=='waiting')advance(7);
    if(attempt==='late'){advance(1.4);advance(2.5);}else fishing.interact();
    assert.equal(fishing.view().phase,'missed');assert.equal(fishing.view().miss,attempt==='late'?'late':'early');
    fishing.interact();assert.equal(fishing.view().phase,'casting');assert.equal(fishing.view().elapsed,0);
  }
});

test('background pauses preserve the bite window and slow frames cannot skip its cue',()=>{
  const {fishing,advance}=game();fishing.interact();advance(1.1);advance(7);advance(1.4);
  fishing.tick(20000,true);fishing.tick(20500,true);
  const remaining=fishing.view().elapsed;fishing.tick(50000,false);fishing.tick(500000,true);
  assert.equal(fishing.view().elapsed,remaining);fishing.pause();fishing.tick(900000,true);
  assert.equal(fishing.view().elapsed,remaining);fishing.interact();assert.equal(fishing.view().phase,'reeling');
  const other=game();other.fishing.interact();other.advance(100);assert.equal(other.fishing.view().phase,'waiting');
  other.advance(100);assert.equal(other.fishing.view().phase,'nibble');other.advance(100);assert.equal(other.fishing.view().phase,'bite');
  assert.equal(other.fishing.view().elapsed,0);
});

test('exiting is idempotent and resetting cancels every active phase',()=>{
  const {fishing,advance}=game();fishing.interact();advance(.4);fishing.exit();advance(.3);
  const leaving=fishing.view();fishing.exit();assert.deepEqual(fishing.view(),leaving);
  advance(.4);assert.equal(fishing.view().phase,'idle');fishing.interact();assert.equal(fishing.view().phase,'idle');
  fishing.start();fishing.reset();advance(100);assert.equal(fishing.view().phase,'idle');
  fishing.start();advance(.9);fishing.interact();fishing.reset();assert.equal(fishing.view().phase,'idle');
});

test('rod picking, moving tackle and repeated rounds retain bounded, owned geometry',()=>{
  const room=new THREE.Group(),dock=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const p=createStudioPrimitives({},room,materials,geometries,textures);
  const model=createDockFishing(p,dock,p.charcoal,p.wood),owned=[materials.size,geometries.size,textures.size];
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(11.2,3,4);camera.lookAt(11.2,.8,.6);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  dock.updateMatrixWorld(true);
  const bounds=()=>({left:0,top:0,width:800,height:800});
  const pick=createStudioPicker({},camera,room,()=>true,bounds,[dock]);
  const point=new THREE.Vector3(11.2,.96,.62).project(camera);
  assert.equal(pick({clientX:(point.x+1)*400,clientY:(1-point.y)*400}),model.group);
  const {fishing}=game();const phases=['casting','waiting','nibble','bite','reeling','caught','releasing'];
  for(let round=0;round<20;round++)for(const phase of phases){
    model.update({...fishing.view(),phase,elapsed:.6},round,true);
    model.group.traverse(object=>{if(object.isMesh){assert.ok(geometries.has(object.geometry));assert.ok(materials.has(object.material));
      const positions=object.geometry.attributes.position.array;assert.ok(positions.every(Number.isFinite));}});
  }
  assert.deepEqual([materials.size,geometries.size,textures.size],owned);
  for(const phase of ['waiting','reeling','releasing']){
    model.update({...fishing.view(),phase,elapsed:.1},0,false);
    const fish=model.group.getObjectByName('fishing-catch'),position=fish.position.clone();
    model.update({...fishing.view(),phase,elapsed:.7},0,false);
    assert.ok(fish.position.equals(position),'reduced motion uses a fixed pose within each phase');
  }
  model.update({...fishing.view(),phase:'idle'},0,false);
  assert.equal(model.group.getObjectByName('fishing-tackle').visible,false);
  assert.equal(model.group.getObjectByName('fishing-rod').rotation.z,0);
  pick.dispose();for(const resource of [...materials,...geometries,...textures])resource.dispose();
});
