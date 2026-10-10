import test from 'node:test';
import assert from 'node:assert/strict';
import {createOceanAudio} from '../src/infrastructure/client/oceanAudio.ts';
import {readOceanAudioPreferences} from '../src/infrastructure/client/oceanAudioPreferences.ts';

test('ocean audio retains one decoded source, suspends on exit, ignores stale work and retries only explicitly',async()=>{
  const saved={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch,window:globalThis.window};
  let context,fetches=0,decodes=0,sources=0,fail=false,resolveFetch;
  const states=[];
  class Context extends EventTarget {
    state='suspended';currentTime=0;destination={};
    gain={value:0,cancelAndHoldAtTime(){},linearRampToValueAtTime(v){this.value=v;}};
    constructor(){super();context=this;}
    createGain(){return {gain:this.gain,connect(){},disconnect(){}};}
    createBufferSource(){sources++;return {buffer:null,loop:false,connect(){},start(){},stop(){},disconnect(){}};}
    async resume(){this.state='running';this.dispatchEvent(new Event('statechange'));}
    async suspend(){this.state='suspended';this.dispatchEvent(new Event('statechange'));}
    async close(){this.state='closed';}
    async decodeAudioData(){decodes++;return {};}
  }
  globalThis.AudioContext=Context;globalThis.window=globalThis;
  globalThis.fetch=()=>{fetches++;return new Promise(resolve=>{resolveFetch=()=>resolve({ok:!fail,arrayBuffer:async()=>new ArrayBuffer(1)});});};
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  try {
    const audio=createOceanAudio(s=>states.push(s));
    audio.setActive(true);await flush();assert.equal(fetches,1);
    audio.setActive(false,true);resolveFetch();await flush();assert.equal(sources,0);
    audio.setActive(true);await flush();assert.equal(sources,1);assert.equal(decodes,1);assert.equal(states.at(-1),'playing');
    audio.setVolume(.37);assert.equal(context.gain.value,.37);
    audio.setActive(false,true);await flush();assert.equal(context.state,'suspended');
    audio.setActive(true);await flush();assert.equal(context.state,'running');assert.equal(sources,1);assert.equal(fetches,1);
    audio.setActive(false);audio.setActive(true);await flush();assert.equal(states.at(-1),'playing');assert.equal(sources,1);
    audio.dispose();await flush();assert.equal(context.state,'closed');
    const broken=createOceanAudio(s=>states.push(s));fail=true;broken.setActive(true);await flush();resolveFetch();await flush();
    assert.equal(states.at(-1),'error');const count=fetches;
    broken.unlock();broken.setActive(false,true);broken.setActive(true);await flush();assert.equal(fetches,count);
    fail=false;broken.retry();await flush();resolveFetch();await flush();assert.equal(states.at(-1),'playing');
    broken.dispose();
  } finally {Object.assign(globalThis,saved);}
});

test('ocean preferences default on at 20 percent and tolerate malformed or unavailable storage',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{"enabled":false,"volume":9}'}});
    assert.deepEqual(readOceanAudioPreferences(),{enabled:false,volume:1});
    for(const value of ['null','[]','{broken','{"enabled":"false","volume":"NaN"}']) {
      globalThis.localStorage.getItem=()=>value;assert.deepEqual(readOceanAudioPreferences(),{enabled:true,volume:.2});
    }
    globalThis.localStorage.getItem=()=>{throw Error('denied');};assert.deepEqual(readOceanAudioPreferences(),{enabled:true,volume:.2});
  } finally {if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
