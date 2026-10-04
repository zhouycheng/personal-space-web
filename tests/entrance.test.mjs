import assert from 'node:assert/strict';
import test from 'node:test';
import { entrancePose, entranceBlend, entranceContentProgress, ENTRANCE_PITCH, ENTRANCE_AZIMUTH, ENTRANCE_OCCUPANCY } from '../src/animation/studio/entranceMotion.ts';
import { islandEntranceDistance, islandViewDistance } from '../src/animation/studio/islandFraming.ts';
import { DEFAULT_ROOM_VIEW } from '../src/contracts/studio.ts';
import { completeEntrance, entranceCompleted } from '../src/infrastructure/client/entranceSession.ts';
import { createFogField } from '../src/justin-kit/components/cloud-entrance/fogField.ts';

test('entrance uses actual 60-degree pitch, holds the opening and lands exactly on the responsive overview',()=>{
  const focus=[0,.35,.2];
  for(const aspect of [390/844,1,1440/900]) {
    const d=islandViewDistance(aspect,DEFAULT_ROOM_VIEW.angle,DEFAULT_ROOM_VIEW.elevation);
    const end=[Math.sin(DEFAULT_ROOM_VIEW.angle)*d,Math.sin(DEFAULT_ROOM_VIEW.elevation)*d+.35,Math.cos(DEFAULT_ROOM_VIEW.angle)*d+.2];
    const far=islandEntranceDistance(aspect,ENTRANCE_AZIMUTH,ENTRANCE_PITCH,ENTRANCE_OCCUPANCY);
    const start=entrancePose(0,far,end,focus),v=start.map((n,i)=>n-focus[i]);
    assert.ok(Math.abs(Math.atan2(v[1],Math.hypot(v[0],v[2]))-Math.PI/3)<1e-12);
    assert.deepEqual(entrancePose(.1,far,end,focus),start);
    assert.deepEqual(entrancePose(1,far,end,focus),end);
    const lengths=Array.from({length:21},(_,i)=>Math.hypot(...entrancePose(i/20,far,end,focus).map((n,j)=>n-focus[j])));
    assert.ok(lengths.every((n,i)=>i===0||n<=lengths[i-1]+1e-10));
    assert.ok(far>Math.hypot(...end.map((n,i)=>n-focus[i]))*1.5);
  }
});

test('ordinary framing retains the pre-entrance distances',()=>{
  // Recorded from the unchanged envelope solver before adding true pitch support.
  for(const [aspect,expected] of [[.5,88.11972857999103],[1,43.207030377132035],[1.6,27.87116955281287]]) {
    assert.ok(Math.abs(islandViewDistance(aspect,-.48,.24)-expected)<1e-11);
  }
});
test('deep links begin behind the clouds and merge into object flight before the overview finishes',()=>{
  assert.equal(entranceContentProgress(.28),0);
  assert.equal(entranceBlend(.3),0);
  assert.ok(entranceContentProgress(.5)>0);assert.ok(entranceBlend(.5)>0);
  assert.equal(entranceBlend(.73),1);assert.equal(entranceContentProgress(1),1);
  for(let i=1;i<=100;i++)assert.ok(entranceBlend(i/100)>=entranceBlend((i-1)/100));
});

test('storage denial falls back to page-local success and does not block entrance',()=>{
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('denied');}});
  assert.equal(entranceCompleted(),false);completeEntrance();assert.equal(entranceCompleted(),true);
  delete globalThis.sessionStorage;
});
test('procedural fog starts opaque, clears the center before its corners and fully exits',()=>{
  const field=createFogField(),width=80,height=60,pixels=new Uint8ClampedArray(width*height*4);
  const alpha=(x,y)=>pixels[(y*width+x)*4+3];
  field.paint(width,height,0,pixels);
  assert.ok(pixels.every((value,index)=>index%4!==3||value===255));
  field.paint(width,height,.43,pixels);
  assert.ok(alpha(40,30)<20);assert.ok(alpha(0,0)>180);assert.ok(alpha(79,59)>180);
  field.paint(width,height,1,pixels);
  assert.ok(pixels.every((value,index)=>index%4!==3||value===0));field.dispose();
});
