import assert from 'node:assert/strict';
import test from 'node:test';
import { nextStudioState as next, stableStudioState, restoredStudioState } from '../src/components/studio/studioState.ts';
import { studioLighting } from '../src/components/studio/studioTime.ts';
import { chairTurn, CHAIR_TURN_MS } from '../src/components/studio/chairMotion.ts';

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

test('studio completes entry and return, ignoring duplicate clicks', () => {
  let state = next('room', 'enter');
  assert.equal(state, 'entering');
  assert.equal(next(state, 'enter'), 'entering');
  state = next(state, 'complete');
  assert.equal(state, 'desktop');
  state = next(state, 'return');
  assert.equal(state, 'returning');
  assert.equal(next(state, 'complete'), 'room');
});
test('route interruption and refresh restore only stable states', () => {
  assert.equal(next('entering', 'cancel'), 'room');
  assert.equal(next('returning', 'cancel'), 'desktop');
  assert.equal(stableStudioState('entering'), 'room');
  assert.equal(stableStudioState('returning'), 'desktop');
  for (const raw of [null, '', 'entering', 'returning', '{bad json}', 'collapsing']) assert.equal(restoredStudioState(raw), 'room');
  assert.equal(restoredStudioState('desktop'), 'desktop');
});
