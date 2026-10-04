import assert from 'node:assert/strict';
import test from 'node:test';
import { clockText, studioLighting } from '../src/config/studioTime.ts';
import { createChairRocking } from '../src/animation/studio/chairMotion.ts';
import { surfaceDistance, surfaceOpacity, surfacePhases, wheelZoom, clampRoomZoom, clampRoomAngle, clampRoomElevation, roomCameraStep, stepRoomView, DEFAULT_ROOM_VIEW } from '../src/animation/studio/studioMotion.ts';
import { ACTION_LABELS } from '../src/contracts/studio.ts';

test('room surface labels identify the canvas and portfolio', () => {
  assert.equal(ACTION_LABELS.canvas, '我的画布');
  assert.equal(Object.hasOwn(ACTION_LABELS, 'about'), false);
  assert.equal(Object.hasOwn(ACTION_LABELS, 'contact'), false);
  assert.equal(ACTION_LABELS.works, '文件木箱');
});

test('camera faces the fixed screen before approaching; live UI fades in during approach', () => {
  for (const [width,height] of [[0.886,0.548],[0.69,0.49]]) {
    for (const aspect of [0.5,1,16/9,2.4]) {
      const distance=surfaceDistance(width,height,aspect,38);
      const viewHeight=2*distance*Math.tan(38*Math.PI/360);
      assert.ok(distance>0);
      assert.ok(viewHeight<height && viewHeight*aspect<width);
    }
  }
  assert.equal(surfaceOpacity(0),0);
  assert.deepEqual(surfacePhases(0),{align:0,approach:0});
  assert.deepEqual(surfacePhases(0.45),{align:1,approach:0});
  assert.deepEqual(surfacePhases(1),{align:1,approach:1});
  assert.equal(surfaceOpacity(0.48),0);
  assert.ok(Math.abs(surfaceOpacity(0.69)-0.5)<1e-12);
  assert.equal(surfaceOpacity(1),1);
});

test('room zoom normalizes wheel units, clamps extremes and reverses immediately at either limit', () => {
  assert.equal(wheelZoom(1, -1e9, 0, 800), 2.2);
  assert.equal(wheelZoom(1, 1e9, 0, 800), 0.85);
  assert.ok(wheelZoom(2.2, 1, 0, 800) < 2.2);
  assert.ok(wheelZoom(0.85, -1, 0, 800) > 0.85);
  assert.equal(wheelZoom(1, -32, 0, 800), wheelZoom(1, -2, 1, 800));
  assert.equal(wheelZoom(1, -80, 0, 800), wheelZoom(1, -0.1, 2, 800));
  assert.ok(Math.abs(wheelZoom(wheelZoom(1, -100, 0, 800), 100, 0, 800)-1)<1e-12);
  assert.equal(wheelZoom(1, 0, 0, 800), 1);
  assert.equal(clampRoomZoom(2.4), 2.2);
  assert.equal(clampRoomZoom(0.5), 0.85);
  assert.deepEqual(DEFAULT_ROOM_VIEW, { zoom: 1, angle: -0.48, elevation: 0.24 });
});

test('room angles stay continuous through multiple complete orbits', () => {
  assert.equal(clampRoomAngle(-100),-100);
  assert.equal(clampRoomAngle(100),100);
  assert.equal(clampRoomElevation(-100),0.2);
  assert.equal(clampRoomElevation(100),1);
  assert.ok(clampRoomAngle(1.22-0.01)<1.22);
  const reset=stepRoomView({...DEFAULT_ROOM_VIEW,angle:Math.PI*4+.3},'reset-view');
  assert.ok(Math.abs(reset.angle-(Math.PI*4-.48))<1e-10,'reset chooses the nearest equivalent home angle');
});

test('explore controls share zoom and angle limits, reverse immediately and reset every axis', () => {
  let view={...DEFAULT_ROOM_VIEW};
  for(let i=0;i<100;i++) for(const action of ['zoom-in','view-right','view-up'])view=stepRoomView(view,action);
  assert.equal(view.zoom,2.2);assert.equal(view.elevation,1);assert.ok(Math.abs(view.angle-11.52)<1e-10);
  for(const [action,key] of [['zoom-out','zoom'],['view-left','angle'],['view-down','elevation']])assert.ok(stepRoomView(view,action)[key]<view[key]);
  for(let i=0;i<100;i++) for(const action of ['zoom-out','view-left','view-down'])view=stepRoomView(view,action);
  assert.equal(view.zoom,.85);assert.equal(view.elevation,.2);assert.ok(Math.abs(view.angle+.48)<1e-10);
  for(const [action,key] of [['zoom-in','zoom'],['view-right','angle'],['view-up','elevation']])assert.ok(stepRoomView(view,action)[key]>view[key]);
  assert.deepEqual(stepRoomView(view,'reset-view'),DEFAULT_ROOM_VIEW);
  assert.equal(view.zoom,.85,'does not mutate the input');
  assert.equal(stepRoomView(DEFAULT_ROOM_VIEW,'zoom-in').zoom,1.2);
  assert.ok(Math.abs(stepRoomView(DEFAULT_ROOM_VIEW,'view-right').angle-DEFAULT_ROOM_VIEW.angle-0.12)<1e-12);
  assert.ok(Math.abs(stepRoomView(DEFAULT_ROOM_VIEW,'view-up').elevation-DEFAULT_ROOM_VIEW.elevation-0.08)<1e-12);
});

test('camera damping is continuous across input changes and independent of frame rate', () => {
  const run=(step,count)=>{let value=1;const speed={velocity:0};for(let i=0;i<count;i++)value=roomCameraStep(value,2.2,step,speed);return value;};
  assert.ok(Math.abs(run(16,12)-run(8,24))<1e-12);
  assert.ok(run(16,12)>2.2-(2.2-1)*0.04);
  let value=1;const speed={velocity:0};
  for(let i=0;i<30;i++) {
    const target=Math.min(2.2,1+(i+1)*0.05),next=roomCameraStep(value,target,16,speed);
    assert.ok(next>value&&next<=target);value=next;
  }
  const before=speed.velocity;
  assert.equal(roomCameraStep(value,.85,0,speed),value);assert.equal(speed.velocity,before);
  assert.ok(roomCameraStep(value,.85,.001,speed)>value,'reversal retains the current velocity');
  assert.equal(roomCameraStep(1,2.2,0,{velocity:0}),1);
  assert.equal(roomCameraStep(1,2.2,-10,{velocity:0}),1);
  assert.equal(roomCameraStep(1,2.2,10000,{velocity:0}),roomCameraStep(1,2.2,64,{velocity:0}));
  assert.equal(run(16,100),2.2);
});

test('rocking chair moves fore and aft with damping and returns to rest', () => {
  const chair=createChairRocking();assert.equal(chair.step(0).angle,0);chair.push();
  const angles=Array.from({length:600},()=>chair.step(1/60).angle);
  assert.ok(angles.every(angle=>Math.abs(angle)<.13));
  assert.ok(angles.some(angle=>angle>.06)&&angles.some(angle=>angle<-.03));
  assert.ok(Math.max(...angles.slice(480).map(Math.abs))<.0065);
  assert.equal(chair.moving,false);
});

test('astronomical lighting follows Shanghai daylight and remains continuous at midnight', () => {
  assert.equal(clockText(new Date(2026,8,11,0,4,9)), '00:04');
  assert.equal(clockText(new Date(2026,8,11,23,59,59)), '23:59');
  assert.equal(clockText(new Date(2026,0,2), true), '01.02');
  assert.equal(clockText(new Date(2026,11,31), true), '12.31');
  assert.equal(clockText(new Date(2028,1,29), true), '02.29');
  const at = (hour, minute = 0, second = 0) => studioLighting(new Date(Date.UTC(2026, 8, 11, hour-8, minute, second)));
  assert.equal(at(0).daylight, 0);
  assert.equal(at(12).daylight, 1);
  assert.deepEqual(
    [at(0).sunIntensity, at(0).ambientIntensity, at(0).lampIntensity, at(0).screenSpillIntensity],
    [0, 0.23, 7, 0.08],
  );
  assert.equal(at(12).sunIntensity, 2.5);
  assert.ok(Math.abs(at(12).ambientIntensity - 1.18) < 1e-12);
  assert.ok(Math.abs(at(12).lampIntensity - 1.2) < 1e-12);
  assert.equal(at(12).screenSpillIntensity, 0);
  assert.ok(at(5, 30).daylight < at(6).daylight);
  assert.equal(at(20).background, '#1c283d');
  assert.notEqual(at(12).background, at(20).background);
  assert.ok(at(6, 30).daylight > at(6).daylight && at(6, 30).daylight < at(7).daylight);
  assert.ok(at(6, 30).screenSpillIntensity > 0 && at(6, 30).screenSpillIntensity < 0.08);
  assert.ok(at(19).daylight < at(18).daylight);
  const before=at(23,59,59),after=at(24);
  assert.ok(Math.hypot(...before.sunDirection.map((v,i)=>v-after.sunDirection[i]))<.0001);
  assert.ok(Math.hypot(...before.moonDirection.map((v,i)=>v-after.moonDirection[i]))<.0001);
  assert.notEqual(at(18).background, at(12).background);
  assert.notEqual(at(12).sky, at(0).sky);
  for (let hour = 0; hour < 24; hour++) {
    const light = at(hour, 30);
    assert.ok(light.daylight >= 0 && light.daylight <= 1);
    assert.ok(light.sunIntensity >= 0 && light.sunIntensity <= 2.5);
    assert.ok(light.ambientIntensity >= 0.18 && light.ambientIntensity <= 1.18);
    assert.ok(Math.abs(Math.hypot(...light.sunDirection)-1)<1e-10);
    assert.ok(Math.abs(Math.hypot(...light.moonDirection)-1)<1e-10);
    assert.ok(light.lampIntensity >= 1.2 && light.lampIntensity <= 7);
    assert.ok(light.screenSpillIntensity >= 0 && light.screenSpillIntensity <= 0.08);
    assert.match(light.background, /^#[0-9a-f]{6}$/);
  }
  assert.ok(at(18).sunset>at(12).sunset);
  assert.ok(at(18).sunDirection[1]<at(12).sunDirection[1]);
});
