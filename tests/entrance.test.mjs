import assert from 'node:assert/strict';
import test from 'node:test';
import { entrancePose, entranceBlend, entranceContentProgress, ENTRANCE_PITCH, ENTRANCE_AZIMUTH, ENTRANCE_OCCUPANCY } from '../src/animation/studio/entranceMotion.ts';
import { islandEntranceDistance, islandViewDistance } from '../src/animation/studio/islandFraming.ts';
import { DEFAULT_ROOM_VIEW } from '../src/contracts/studio.ts';
import { completeEntrance, entranceCompleted } from '../src/infrastructure/client/entranceSession.ts';
import { createFogField, createFogTrail } from '../src/justin-kit/components/cloud-entrance/fogField.ts';
import { entranceTimePalette } from '../src/justin-kit/components/cloud-entrance/timePalette.ts';

test('entrance palette follows local night, dawn, day and dusk with soft transitions',()=>{
  const at=(hour,minute=0)=>entranceTimePalette(new Date(2026,0,15,hour,minute));
  assert.deepEqual(at(1).background,[22,30,46]);
  assert.deepEqual(at(12).background,[198,208,210]);
  assert.notDeepEqual(at(6).mist,at(12).mist);
  assert.notDeepEqual(at(18).cloud,at(12).cloud);
  assert.deepEqual(at(23).background,[22,30,46]);
  const before=at(6,29).background,after=at(6,31).background;
  assert.ok(before.every((channel,index)=>Math.abs(channel-after[index])<=2));
});

test('cloud lighting stays dark at night and near-neutral at dawn and dusk', () => {
  const field = createFogField(), pixels = new Uint8ClampedArray(48 * 32 * 4);
  const luminance = ([r, g, b]) => r * .2126 + g * .7152 + b * .0722;
  const night = entranceTimePalette(new Date(2026, 9, 5, 1));
  const day = entranceTimePalette(new Date(2026, 9, 5, 12));
  assert.ok(luminance(night.cloud) < luminance(day.cloud) * .3);
  assert.ok(luminance(night.cloud) - luminance(night.mist) < 15);
  for (const hour of [6, 18]) {
    const { cloud } = entranceTimePalette(new Date(2026, 9, 5, hour));
    assert.ok(Math.max(...cloud) - Math.min(...cloud) < 15, 'ambient tint must remain subtle');
  }
  for (const p of [0, .15, .35, .6]) {
    field.paint(48, 32, p, pixels, night.cloud);
    assert.ok(pixels.every((v, i) => i % 4 === 3 || v < 80), 'night scattering must not create white highlights');
  }
  field.dispose();
});

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

test('fog sampling is deterministic, continuous in time and valid across aspect ratios', () => {
  const field = createFogField();
  for (const [width, height] of [[96, 60], [39, 84], [1, 1]]) {
    const a = new Uint8ClampedArray(width * height * 4), b = new Uint8ClampedArray(a.length);
    for (const progress of [0, .15, .35, .6, .85, 1]) {
      field.paint(width, height, progress, a);
      field.paint(width, height, progress, b);
      assert.deepEqual(a, b);
      if (progress === 0) assert.ok(a.every((v, i) => i % 4 !== 3 || v === 255));
      if (progress === 1) assert.ok(a.every((v, i) => i % 4 !== 3 || v === 0));
      field.paint(width, height, Math.min(1, progress + .0001), b);
      assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 5), 'small time steps must not pop');
    }
  }
  field.dispose();
});

test('fog trail covers fast strokes locally, stays bounded and recovers after 1600 active milliseconds', () => {
  const trail = createFogTrail(), width = 96, height = 60;
  trail.resize(width, height);
  const from = { x: 20, y: 30 }, to = { x: 76, y: 30 };
  for (let i = 0; i < 100; i++) trail.stroke(from, to, 8);
  assert.equal(trail.advance(100), true);
  for (let x = 20; x <= 76; x++) {
    const index = 30 * width + x;
    assert.ok(trail.mask[index] > .65 && trail.mask[index] <= 1, 'the swept path has no holes or accumulated opacity');
    assert.equal(trail.flowX[index], 1); assert.equal(trail.flowY[index], 0);
  }
  assert.equal(trail.mask[20 * width + 48], 0);
  assert.equal(trail.mask[30 * width + 10], 0);
  const peak = trail.mask[30 * width + 48];
  trail.resize(width, height);
  assert.equal(trail.mask[30 * width + 48], peak, 'a palette rebake keeps the live trail');
  assert.equal(trail.advance(900), true);
  assert.ok(trail.mask[30 * width + 48] > .3 && trail.mask[30 * width + 48] < peak);
  assert.equal(trail.advance(600), false);
  assert.ok(trail.mask.every(value => value === 0));
  trail.stroke(to, from, 8); trail.advance(100);
  assert.equal(trail.flowX[30 * width + 48], -1);
  trail.clear();
  assert.equal(trail.advance(16), false);
  trail.resize(39, 84); trail.stroke({ x: 0, y: 0 }, { x: 38, y: 83 }, 6); trail.advance(100);
  assert.ok(trail.mask.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  trail.dispose(); assert.equal(trail.mask.length, 0); assert.equal(trail.flowX.length, 0); assert.equal(trail.flowY.length, 0);
});

test('fog trail moves and thins only its local veil while retaining opaque loading cover', () => {
  const field = createFogField(), trail = createFogTrail(), width = 96, height = 60;
  trail.resize(width, height);
  const baseline = new Uint8ClampedArray(width * height * 4), swept = new Uint8ClampedArray(baseline.length);
  field.paint(width, height, 0, baseline);
  trail.stroke({ x: 25, y: 30 }, { x: 65, y: 30 }, 10); trail.advance(120);
  field.paint(width, height, 0, swept, undefined, trail);
  let changed = 0;
  for (let i = 0; i < baseline.length; i += 4) {
    assert.equal(swept[i + 3], 255);
    if (trail.mask[i / 4] === 0) assert.deepEqual(swept.subarray(i, i + 4), baseline.subarray(i, i + 4));
    else if (swept[i] !== baseline[i]) changed++;
  }
  assert.ok(changed > 100);
  trail.advance(1480); field.paint(width, height, 0, swept, undefined, trail);
  assert.deepEqual(swept, baseline);
  trail.stroke({ x: 25, y: 30 }, { x: 65, y: 30 }, 10); trail.advance(120);
  field.paint(width, height, .43, baseline); field.paint(width, height, .43, swept, undefined, trail);
  assert.deepEqual(swept, baseline, 'the host reveal remains independent of hover');
  field.dispose(); trail.dispose();
});
