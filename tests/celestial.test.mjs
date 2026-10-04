import test from 'node:test';
import assert from 'node:assert/strict';
import {studioLighting,celestialDirection} from '../src/config/studioTime.ts';

test('desk compass maps north to -Z and east to +X',()=>{
  for(const [azimuth,expected] of [[0,[0,0,-1]],[90,[1,0,0]],[180,[0,0,1]],[270,[-1,0,0]]]) {
    const direction=celestialDirection(azimuth,0);
    assert.ok(direction.every((v,i)=>Math.abs(v-expected[i])<1e-12));
  }
});
test('Shanghai equinox sun rises east and sets west; season and moon have independent paths',()=>{
  const at=(date)=>studioLighting(new Date(date));
  const dawn=at('2026-03-20T06:00:00+08:00'),dusk=at('2026-03-20T18:00:00+08:00');
  assert.ok(dawn.sunDirection[0]>.95);assert.ok(dusk.sunDirection[0]<-.95);
  assert.ok(at('2026-06-21T12:00:00+08:00').sunDirection[1]>at('2026-12-21T12:00:00+08:00').sunDirection[1]);
  const summer=at('2026-06-21T05:30:00+08:00'),winter=at('2026-12-21T05:30:00+08:00');
  assert.ok(summer.daylight>winter.daylight);
  const a=at('2026-10-04T00:00:00+08:00'),b=at('2026-10-05T00:00:00+08:00');
  assert.ok(Math.hypot(...a.moonDirection.map((v,i)=>v-b.moonDirection[i]))>.1);
  assert.ok(Math.abs(a.sunDirection.reduce((sum,v,i)=>sum+v*a.moonDirection[i],0))<.95);
  assert.equal(a.sunIntensity,0);
});
