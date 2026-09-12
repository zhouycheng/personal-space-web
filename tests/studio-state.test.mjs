import assert from 'node:assert/strict';
import test from 'node:test';
import { clockText, studioLighting } from '../src/components/studio/studioTime.ts';
import { chairTurn, CHAIR_TURN_MS } from '../src/components/studio/chairMotion.ts';
import { surfaceDistance, surfaceOpacity, surfacePhases, galleryStep } from '../src/components/studio/studioMotion.ts';
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
