import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { acceptsIslandFocus,clampIslandFocus } from '../src/animation/studio/islandNavigation.ts';
import { coastRadius } from '../src/config/islandTerrain.ts';
import { canopyDistanceOpacity } from '../src/animation/studio/canopyVisibility.ts';
import { createStudioGestureController } from '../src/presentation/interaction/studio/sceneGestures.ts';

test('navigation accepts the island, rejects sea targets and confines zoom destinations',()=>{
  assert.equal(acceptsIslandFocus({x:0,y:1.5,z:-1}),true);
  for(const point of [{x:20,y:0,z:0},{x:0,y:-1,z:0},{x:NaN,y:0,z:0}])assert.equal(acceptsIslandFocus(point),false);
  for(let angle=0;angle<Math.PI*2;angle+=.1){
    const point=clampIslandFocus({x:100*Math.cos(angle),y:50,z:100*Math.sin(angle)});
    assert.ok(coastRadius(point.x,point.z)<=.860001);assert.equal(point.y,2.8);
  }
  assert.equal(canopyDistanceOpacity([0,2,5]),0,'Close eye-level desk inspection hides the cloth');
  assert.equal(canopyDistanceOpacity([0,12,20]),1,'Distant island views retain the cloth');
});

test('drag always orbits, right drag is ignored, and multitouch zooms without activating props',()=>{
  const previous=globalThis.window;globalThis.window=new EventTarget();
  const signal=new AbortController(),capture=new Set(),rect={left:0,top:0,width:100,height:100};
  const canvas=Object.assign(new EventTarget(),{style:{},getBoundingClientRect:()=>rect,setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)});
  const room=new THREE.Group(),hotspot=new THREE.Group();hotspot.userData.action='computer';room.add(hotspot);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial());hotspot.add(mesh);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5;camera.lookAt(0,0,0);
  const actions=[],orbits=[],zooms=[];
  let controller;
  const dispatch=(type,x=50,y=50,extra={})=>{const event=new Event(type);Object.assign(event,{clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,shiftKey:false,...extra});canvas.dispatchEvent(event);};
  try{
    controller=createStudioGestureController({canvas,camera,room,mount:{dataset:{}},tooltip:{hidden:true,style:{}},signal:signal.signal,bounds:{canvas:()=>rect,mount:()=>rect,invalidate(){}},canInteract:()=>true,canPickJournal:()=>true,onWheel:(...args)=>zooms.push(args),orbit:(...args)=>orbits.push(args),onAction:action=>actions.push(action),requestDraw(){},requestInputFrame(){}});
    dispatch('pointerdown');dispatch('pointerup');assert.deepEqual(actions,['computer']);
    dispatch('pointerdown');dispatch('pointermove',65);dispatch('pointerup',70);assert.ok(orbits.length>0);assert.equal(actions.length,1);
    const count=orbits.length;
    dispatch('pointerdown',50,50,{shiftKey:true});dispatch('pointerup',70,60,{shiftKey:true});assert.equal(orbits.length,count+1);assert.equal(actions.length,1);
    dispatch('pointerdown',50,50,{button:2});dispatch('pointerup',70,60,{button:2});assert.equal(orbits.length,count+1);assert.equal(capture.size,0);
    dispatch('pointerdown',30,50,{pointerType:'touch'});dispatch('pointerup',50,50,{pointerType:'touch'});assert.equal(orbits.length,count+2);assert.equal(actions.length,1);
    dispatch('pointerdown',30,50,{pointerType:'touch'});dispatch('pointerdown',70,50,{pointerId:2,pointerType:'touch'});
    dispatch('pointermove',85,60,{pointerId:2,pointerType:'touch'});controller.flushMove();
    assert.ok(zooms.length>0);
    dispatch('pointerup',85,60,{pointerId:2,pointerType:'touch'});dispatch('pointerup',30,50,{pointerType:'touch'});
    assert.equal(actions.length,1);assert.equal(capture.size,0);
    zooms.length=0;
    for(let i=0;i<20;i++)dispatch('wheel',50,50,{deltaY:-2,deltaMode:0});
    assert.equal(zooms.length,0,'wheel events defer camera work until the next frame');
    dispatch('wheel',50,50,{deltaY:1,deltaMode:1});
    controller.flushMove();assert.deepEqual(zooms.map(args=>args[0]),[-40,16],'merge a burst but preserve direction reversals');
    dispatch('wheel',50,50,{deltaY:-2,deltaMode:0});controller.reset();controller.flushMove();
    assert.equal(zooms.length,2,'cancelled gestures discard pending wheel work');
  }finally{signal.abort();globalThis.window=previous;mesh.geometry.dispose();mesh.material.dispose();}
});
