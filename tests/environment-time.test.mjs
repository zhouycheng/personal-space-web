import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentAt } from '../src/config/studioTime.ts';
import { observatories } from '../src/config/observatories.ts';
import { readObservation, saveRegion, saveLocation, locate, REGION_KEY, LOCATION_KEY, LOCATION_TTL } from '../src/infrastructure/client/observation.ts';

const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('regions change astronomy; timestamp is independent of display time zone',()=>{
  const timestamp=new Date('2026-03-20T06:00:00+08:00');
  const east=environmentAt(timestamp,observatories.east),west=environmentAt(timestamp,observatories.west);
  assert.ok(east.solarAltitude>west.solarAltitude+15);
  assert.deepEqual(east,environmentAt(new Date('2026-03-19T22:00:00Z'),observatories.east));
  for(const observer of Object.values(observatories)) {
    const summer=environmentAt(new Date('2026-06-21T05:30:00+08:00'),observer);
    const winter=environmentAt(new Date('2026-12-21T05:30:00+08:00'),observer);
    assert.ok(summer.solarAltitude>winter.solarAltitude);
  }
});
test('solar palettes evolve continuously, distinguish dawn from sunset, and share entrance background',()=>{
  const colors=new Set();let previous;
  for(let minute=0;minute<1440;minute++) {
    const snapshot=environmentAt(new Date(Date.UTC(2026,9,5,0,minute)));
    const {lighting,palette}=snapshot;
    colors.add(lighting.zenith);
    assert.equal(lighting.background,'#'+palette.background.map(c=>c.toString(16).padStart(2,'0')).join(''));
    if(snapshot.solarAltitude<=0)assert.equal(lighting.sunIntensity,0);
    if(snapshot.lunarAltitude<=0)assert.equal(lighting.moonIntensity,0);
    if(previous)for(let i=0;i<3;i++)assert.ok(Math.abs(palette.mist[i]-previous.palette.mist[i])<=5);
    previous=snapshot;
  }
  assert.ok(colors.size>200);
  const before=environmentAt(new Date('2026-10-04T23:59:59+08:00'));
  const after=environmentAt(new Date('2026-10-05T00:00:00+08:00'));
  assert.deepEqual(before.palette,after.palette);
  const morning=environmentAt(new Date('2026-03-20T06:20:00+08:00'));
  const evening=environmentAt(new Date('2026-03-20T17:40:00+08:00'));
  assert.notEqual(morning.lighting.horizon,evening.lighting.horizon);
  assert.ok((evening.lighting.sun>>8&255)>180,'golden yellow contains green, not only red');
});
test('polar and southern observers have finite continuous output without rise/set assumptions',()=>{
  for(const observer of [{latitude:90,longitude:0},{latitude:-90,longitude:0},{latitude:-34,longitude:151}])
    for(const date of ['2026-06-21','2026-12-21']) {
      const snapshot=environmentAt(new Date(date),observer);
      assert.ok(snapshot.lighting.sunDirection.every(Number.isFinite));
      assert.ok(snapshot.palette.mist.every(Number.isFinite));
    }
});
test('regional preference survives; location expires, invalid storage and storage denial recover',()=>{
  const local=storage(),session=storage(),now=100000000;
  saveRegion('west',()=>local,()=>session);
  assert.equal(readObservation(now,()=>local,()=>session).region,'west');
  saveLocation({latitude:20,longitude:100,acquiredAt:now,source:'location',region:'west'},()=>session);
  assert.equal(local.getItem(LOCATION_KEY),null);
  assert.equal(readObservation(now,()=>local,()=>session).source,'location');
  assert.equal(readObservation(now+LOCATION_TTL,()=>local,()=>session).source,'region');
  for(const invalid of ['broken','{"latitude":100,"longitude":0,"acquiredAt":100000000}','null']){
    session.setItem(LOCATION_KEY,invalid);assert.equal(readObservation(now,()=>local,()=>session).source,'region');
  }
  local.setItem(REGION_KEY,'unknown');assert.equal(readObservation(now,()=>local,()=>session).region,'east');
  const denied=()=>{throw new Error('denied');};
  assert.equal(readObservation(now,denied,denied).region,'east');
  assert.doesNotThrow(()=>saveRegion('north',denied,denied));
});
test('location request is explicit, bounded and handles success, denial, timeout and abort',async t=>{
  const signal=new AbortController().signal;
  assert.deepEqual(await locate({getCurrentPosition(success,_failure,options){assert.equal(options.timeout,8000);success({coords:{latitude:31,longitude:121}});}},signal),{latitude:31,longitude:121});
  await assert.rejects(locate(undefined,signal),/无法定位/);
  await assert.rejects(locate({getCurrentPosition(_success,failure){failure({code:1});}},signal),/授权/);
  const controller=new AbortController();const request=locate({getCurrentPosition(){}},controller.signal);controller.abort();await assert.rejects(request,/取消/);
  t.mock.timers.enable({apis:['setTimeout']});
  const stalled=locate({getCurrentPosition(){}},signal);const checked=assert.rejects(stalled,/超时/);
  t.mock.timers.tick(8000);await checked;
});
