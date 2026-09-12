import assert from 'node:assert/strict';
import test from 'node:test';
import { clockText, studioLighting } from '../src/components/studio/studioTime.ts';
import { chairTurn, CHAIR_TURN_MS } from '../src/components/studio/chairMotion.ts';
import { surfaceDistance, surfaceOpacity, surfacePhases, galleryStep, wheelZoom, clampRoomZoom, clampRoomAngle, clampRoomElevation, roomCameraStep, stepRoomView, DEFAULT_ROOM_VIEW } from '../src/components/studio/studioMotion.ts';
import { ACTION_LABELS } from '../src/components/studio/studioState.ts';

test('room surface labels identify the canvas and portfolio', () => {
  assert.equal(ACTION_LABELS.canvas, '我的画布');
  assert.equal(Object.hasOwn(ACTION_LABELS, 'about'), false);
  assert.equal(Object.hasOwn(ACTION_LABELS, 'contact'), false);
  assert.equal(ACTION_LABELS.works, '作品集');
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

test('gallery motion is capped, settles and never overshoots', () => {
  assert.ok(galleryStep(0,1000,16)<=6.72);
  assert.ok(galleryStep(1000,0,16)>=993.28);
  assert.equal(galleryStep(10,10,16),10);
  assert.equal(galleryStep(0,10,0),0);
  let x=0;
  for(let i=0;i<400;i++){x=galleryStep(x,300,16);assert.ok(x>=0&&x<=300);}
  assert.ok(Math.abs(x-300)<0.01);
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
  assert.deepEqual(DEFAULT_ROOM_VIEW, { zoom: 1, angle: -0.48, elevation: 0.55 });
});

test('room angles keep the camera in front of the desk at every zoom and viewport', () => {
  assert.equal(clampRoomAngle(-100),-1.22);
  assert.equal(clampRoomAngle(100),1.22);
  assert.equal(clampRoomElevation(-100),0.2);
  assert.equal(clampRoomElevation(100),1);
  assert.ok(clampRoomAngle(1.22-0.01)<1.22);
  for(const aspect of [0.3,0.46,1,16/9,3]) for(const zoom of [0.85,1,2.2]) for(const angle of [-1.22,0,1.22]) {
    const distance=Math.max(8.5,8.5/aspect)/zoom;
    assert.ok(-1.25+Math.cos(angle)*distance>-0.55, 'camera remains ahead of the front desk edge');
  }
});

test('explore controls share zoom and angle limits, reverse immediately and reset every axis', () => {
  let view={...DEFAULT_ROOM_VIEW};
  for(let i=0;i<100;i++) for(const action of ['zoom-in','view-right','view-up'])view=stepRoomView(view,action);
  assert.deepEqual(view,{zoom:2.2,angle:1.22,elevation:1});
  for(const [action,key] of [['zoom-out','zoom'],['view-left','angle'],['view-down','elevation']])assert.ok(stepRoomView(view,action)[key]<view[key]);
  for(let i=0;i<100;i++) for(const action of ['zoom-out','view-left','view-down'])view=stepRoomView(view,action);
  assert.deepEqual(view,{zoom:0.85,angle:-1.22,elevation:0.2});
  for(const [action,key] of [['zoom-in','zoom'],['view-right','angle'],['view-up','elevation']])assert.ok(stepRoomView(view,action)[key]>view[key]);
  assert.deepEqual(stepRoomView(view,'reset-view'),DEFAULT_ROOM_VIEW);
  assert.deepEqual(view,{zoom:0.85,angle:-1.22,elevation:0.2},'does not mutate the input');
  assert.equal(stepRoomView(DEFAULT_ROOM_VIEW,'zoom-in').zoom,1.2);
  assert.ok(Math.abs(stepRoomView(DEFAULT_ROOM_VIEW,'view-right').angle-DEFAULT_ROOM_VIEW.angle-0.12)<1e-12);
  assert.ok(Math.abs(stepRoomView(DEFAULT_ROOM_VIEW,'view-up').elevation-DEFAULT_ROOM_VIEW.elevation-0.08)<1e-12);
});

test('camera damping is continuous across input changes and independent of frame rate', () => {
  const run=(step,count)=>{let value=1;for(let i=0;i<count;i++)value=roomCameraStep(value,2.2,step);return value;};
  assert.ok(Math.abs(run(16,12)-run(8,24))<1e-12);
  assert.ok(run(16,12)>2.2-(2.2-1)*0.04);
  let value=1;
  for(let i=0;i<30;i++) {
    const target=Math.min(2.2,1+(i+1)*0.05),next=roomCameraStep(value,target,16);
    assert.ok(next>value&&next<=target);value=next;
  }
  assert.ok(roomCameraStep(value,0.85,16)<value);
  assert.equal(roomCameraStep(1,2.2,0),1);
  assert.equal(roomCameraStep(1,2.2,-10),1);
  assert.equal(roomCameraStep(1,2.2,10000),roomCameraStep(1,2.2,64));
  assert.equal(run(16,100),2.2);
});

test('chair turns exactly once with acceleration, a longer coast and no overshoot', () => {
  assert.equal(chairTurn(0).angle, 0);
  assert.equal(chairTurn(CHAIR_TURN_MS).angle, Math.PI * 2);
  assert.equal(chairTurn(CHAIR_TURN_MS * 2).angle, Math.PI * 2);
  assert.equal(chairTurn(CHAIR_TURN_MS).done, true);
  const angles = Array.from({ length: 101 }, (_, i) => chairTurn(CHAIR_TURN_MS * i / 100).angle);
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] >= angles[i-1]);
  assert.ok(angles[2]-angles[1] > angles[1]-angles[0]);
  assert.ok(angles[100]-angles[99] < angles[90]-angles[89]);
});

test('local time lighting interpolates dawn and dusk and wraps midnight continuously', () => {
  assert.equal(clockText(new Date(2026,8,11,0,4,9)), '00:04');
  assert.equal(clockText(new Date(2026,8,11,23,59,59)), '23:59');
  assert.equal(clockText(new Date(2026,0,2), true), '01.02');
  assert.equal(clockText(new Date(2026,11,31), true), '12.31');
  assert.equal(clockText(new Date(2028,1,29), true), '02.29');
  const at = (hour, minute = 0, second = 0) => studioLighting(new Date(2026, 8, 11, hour, minute, second));
  assert.equal(at(0).daylight, 0);
  assert.equal(at(12).daylight, 1);
  assert.ok(at(6).daylight > at(5).daylight && at(6).daylight < at(7).daylight);
  assert.ok(at(19).daylight < at(18).daylight && at(19).daylight > at(21).daylight);
  assert.deepEqual(at(23, 59, 59), at(0));
  assert.notEqual(at(18).background, at(12).background);
  assert.notEqual(at(12).sky, at(0).sky);
  for (let hour = 0; hour < 24; hour++) {
    const light = at(hour, 30);
    assert.ok(light.daylight >= 0 && light.daylight <= 1);
    assert.match(light.background, /^#[0-9a-f]{6}$/);
  }
});
