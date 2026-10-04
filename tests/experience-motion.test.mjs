import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createChairRocking,CHAIR_ROCKER_RADIUS as R} from '../src/animation/studio/chairMotion.ts';
import {surfaceFlight} from '../src/animation/studio/studioMotion.ts';
import {createEdgeDeriver} from '../src/presentation/ui/canvas/derivedEdges.ts';
import {createStudioPrimitives} from '../src/presentation/scene/studio/studioPrimitives.ts';

test('rocker impulses preserve pose, roll on the floor and settle at different frame rates',()=>{
  const results=[];
  for(const hz of [30,60,120]){
    const chair=createChairRocking();chair.push();
    for(let i=0;i<hz;i++)chair.step(1/hz);
    const before=chair.step(0);chair.push();assert.deepEqual(chair.step(0),before);
    for(let i=0;i<hz*2;i++){
      const {angle,y,z}=chair.step(1/hz);
      const contact=new THREE.Vector3(0,R-R*Math.cos(angle),R*Math.sin(angle)).applyAxisAngle(new THREE.Vector3(1,0,0),angle).add(new THREE.Vector3(0,y,z));
      assert.ok(Math.abs(contact.y)<1e-9);assert.ok(Math.abs(angle)<.25);
    }
    results.push(chair.step(0).angle);
    for(let i=0;i<hz*15;i++)chair.step(1/hz);
    assert.equal(chair.moving,false);assert.deepEqual(chair.step(0),{angle:0,y:0,z:0});
  }
  assert.ok(Math.max(...results)-Math.min(...results)<1e-10);
});

test('device path has matching velocities at alignment and preserves its endpoints',()=>{
  for(const [from,via,to,look] of [
    [[-8,8,14],[0,3,6],[0,1.5,1],[0,1.2,0]],
    [[7,8,-14],[1,7,-1],[1,2,-1],[1,1.4,-1]],
  ]){
    const f=t=>surfaceFlight(from,via,to,look,t),e=1e-5;
    for(let k=0;k<3;k++){
      assert.ok(Math.abs(f(0)[k]-from[k])<1e-10);assert.ok(Math.abs(f(1)[k]-to[k])<1e-10);
      const left=(f(.45)[k]-f(.45-e)[k])/e,right=(f(.45+e)[k]-f(.45)[k])/e;
      assert.ok(Math.abs(left-right)<.015,`axis ${k}: ${left}, ${right}`);
    }
  }
});

test('local canvas motion preserves unrelated edges and stable handle pairs',()=>{
  const node=(id,x,y)=>({id,position:{x,y},data:{width:100,height:100}});
  const a=node('a',0,0),b=node('b',200,0),c=node('c',400,0);
  const derive=createEdgeDeriver([{id:'ab',source:'a',target:'b'},{id:'bc',source:'b',target:'c'}]);
  const first=derive([a,b,c]).edges;
  assert.equal(derive([a,node('b',210,0),c]).edges,first);
  const next=derive([node('a',200,300),b,c]).edges;
  assert.notEqual(next[0],first[0]);assert.equal(next[1],first[1]);
});

test('construction cleanup releases detached geometry but retains shared live instances',()=>{
  const scene=new THREE.Group(),materials=new Set(),geometries=new Set(),p=createStudioPrimitives({},scene,materials,geometries,new Set());
  const a=p.box(scene,[1,1,1],[0,0,0]),b=p.box(scene,[1,1,1],[2,0,0]),orphan=p.box(scene,[2,2,2],[0,0,0]);
  let disposed=0;orphan.geometry.addEventListener('dispose',()=>disposed++);scene.remove(a,orphan);
  p.releaseConstructionGeometry(scene);p.releaseConstructionGeometry(scene);
  assert.equal(disposed,1);assert.ok(geometries.has(b.geometry));assert.ok(!geometries.has(orphan.geometry));
  for(const resource of [...materials,...geometries])resource.dispose();
});
