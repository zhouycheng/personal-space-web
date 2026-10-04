import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournalController } from '../src/application/journal/readerController.ts';
import { createActiveMotion } from '../src/animation/activeMotion.ts';

const complete = () => Promise.resolve({status:'completed',value:undefined});
const book = {
  version:2,hash:'a',renderHash:'a',contentHash:'b',availability:'ready',width:420,height:594,
  articles:[{slug:'first',title:'First',start:0,count:2},{slug:'last',title:'Last',start:2,count:1}],
  pages:[{index:0,slug:'first',anchors:['one']},{index:1,slug:'first',anchors:['two']},{index:2,slug:'last',anchors:['three']}],
};
function harness(manifest=book, services={}) {
  const calls=[],saves=[];
  let report; const reports=[];
  const scene={
    journalAvailable:()=>true,
    configureJournal:(_book,page,callback)=>{calls.push(['configure',page]);report=callback;reports.push(callback);},
    setJournalInteractionEnabled:()=>{},prepareJournal:()=>{},cancelTransition:()=>{},retryJournal:()=>{},
    moveJournal:async enter=>{calls.push(['move',enter]);return complete();},journalReady:complete,
    openJournal:async value=>{calls.push(['open',value]);return complete();},hideJournal:()=>calls.push(['hide']),
    cancelJournalPrefetch:()=>{},turnJournal:direction=>calls.push(['turn',direction]),
  };
  const controller=createJournalController(manifest,{
    scene:()=>scene,saved:null,save:value=>saves.push(value),replaceArticle:slug=>calls.push(['replace',slug]),region:()=>{},
    exit:()=>calls.push(['exit']),deadline:task=>task,...services,
  });
  return {controller,scene,calls,saves,reports,report:value=>report({page:0,single:true,busy:false,error:'',phase:'reading',zoom:1,textures:2,drawn:true,textureBytes:1,decodeBytes:1,...value})};
}
test('background suspension advances animations only during active frames',async()=>{
  const motion=createActiveMotion(),frames=[];
  const result=motion.start(100,value=>frames.push(value));
  motion.tick(100);motion.tick(150);motion.pause();motion.tick(60150);
  assert.equal(frames.at(-1),.5);
  motion.tick(60200);
  assert.deepEqual(await result,{status:'completed',value:undefined});
  assert.equal(frames.at(-1),1);
});
test('superseded and cancelled animations never sample the target or complete',async()=>{
  const motion=createActiveMotion(),frames=[];
  const first=motion.start(100,t=>frames.push(t));motion.tick(0);motion.tick(20);
  const second=motion.start(100,()=>{});
  assert.equal((await first).status,'cancelled');assert.equal(frames.at(-1),.2);
  motion.cancel('navigation');assert.deepEqual(await second,{status:'cancelled',reason:'navigation'});
});
test('invalid articles and unavailable packages cannot enter the renderer',async()=>{
  for(const availability of ['missing','outdated','empty','error']){
    const h=harness({...book,availability});await h.controller.enter({},0);
    assert.equal(h.controller.$session.get().availability,availability);assert.deepEqual(h.calls,[]);
  }
  const h=harness();await h.controller.enter({slug:'removed'},0);
  assert.equal(h.controller.$session.get().availability,'error');assert.deepEqual(h.calls,[]);
});
test('entry opens the desktop book and explicit anchors select the chosen article',async()=>{
  const plain=harness();await plain.controller.enter({},0);
  assert.equal(plain.controller.$session.get().phase,'reading');assert.equal(plain.calls.some(([kind])=>kind==='open'),true);
  const linked=harness();await linked.controller.enter({slug:'first',anchor:'two'},0);
  assert.equal(linked.calls[0][1],1);assert.deepEqual(linked.calls.at(-1),['open',true]);
  assert.equal(linked.controller.$session.get().phase,'reading');
});
test('first journal entrance forwards the shared motion clock and budgets its duration',async()=>{
  const deadlines=[];
  const h=harness(book,{deadline:(task,duration)=>{deadlines.push(duration);return task;}});
  const progress=[];const entrance={duration:3000,onProgress:value=>progress.push(value)};
  h.scene.moveJournal=async(enter,duration,options)=>{
    assert.equal(enter,true);assert.equal(duration,0);assert.equal(options,entrance);
    options.onProgress(.35);options.onProgress(1);return complete();
  };
  await h.controller.enter({slug:'first',anchor:'two'},0,entrance);
  assert.ok(deadlines[0]>=entrance.duration);
  assert.deepEqual(progress,[.35,1]);assert.equal(h.controller.$session.get().phase,'reading');
  assert.equal(h.calls[0][1],1);
});
test('only a stable, rendered reading frame commits a bookmark and cross-article URL',async()=>{
  const h=harness();await h.controller.enter({slug:'first'},0);
  h.report({drawn:false});h.report({busy:true});assert.equal(h.saves.length,0);
  h.report({page:0});assert.equal(h.saves.length,1);
  h.report({page:2});assert.deepEqual(h.calls.at(-1),['replace','last']);assert.equal(h.saves.at(-1).slug,'last');
  h.controller.failed('lost');h.report({page:1});assert.equal(h.controller.$session.get().availability,'error');assert.equal(h.saves.length,2);
});
test('leaving during preparation invalidates late completion; escape always has an exit path',async()=>{
  const h=harness();let finish;
  h.scene.moveJournal=()=>new Promise(resolve=>{finish=resolve;});
  const entering=h.controller.enter({},1000);
  h.controller.escape();assert.deepEqual(h.calls.at(-1),['exit']);
  h.controller.deactivate();finish({status:'completed',value:undefined});await entering;
  assert.equal(h.controller.$session.get().active,false);assert.equal(h.controller.$session.get().phase,'stowed');
});
test('a renderer failure invalidates pending preparation even if its promise completes later',async()=>{
  const h=harness();let finish;
  h.scene.moveJournal=()=>new Promise(resolve=>{finish=resolve;});
  const entering=h.controller.enter({slug:'first'},1000);
  h.controller.failed('context lost','unsupported');
  h.report({page:1});
  finish({status:'completed',value:undefined});await entering;
  assert.equal(h.controller.$session.get().availability,'unsupported');
  assert.equal(h.controller.$session.get().phase,'extracting');
  assert.equal(h.saves.length,0);
  assert.equal(h.calls.some(([kind])=>kind==='open'),false);
});
test('an old rendered report cannot turn recovery into a ready reading session',async()=>{
  let finish;
  const h=harness(book,{recovering:()=>new Promise(resolve=>{finish=resolve;})});
  await h.controller.enter({slug:'first'},0);
  h.controller.failed('context lost','unsupported');
  h.scene.journalAvailable=()=>false;
  const retrying=h.controller.retry();
  h.report({page:1});
  assert.equal(h.controller.$session.get().availability,'recovering');
  assert.equal(h.controller.$session.get().busy,true);
  assert.equal(h.saves.length,0);
  h.controller.deactivate();finish();await retrying;
  assert.equal(h.controller.$session.get().active,false);
});
test('retry ignores the previous operation error emitted during reconfiguration',async()=>{
  const h=harness();await h.controller.enter({slug:'first'},0);
  const oldReport=h.reports[0];h.report({error:'Failed to fetch'});
  assert.equal(h.controller.$session.get().availability,'error');
  const configure=h.scene.configureJournal;
  h.scene.configureJournal=(...args)=>{
    oldReport({error:'Failed to fetch'});
    configure(...args);
  };
  await h.controller.retry();
  assert.equal(h.controller.$session.get().availability,'ready');
  assert.equal(h.controller.$session.get().phase,'reading');
  oldReport({error:'late old failure'});
  assert.equal(h.controller.$session.get().availability,'ready');
  h.report({page:1});assert.equal(h.controller.$session.get().page,1);
});
test('synchronous book initialization failure exposes an exit and a working retry',async()=>{
  const h=harness(),configure=h.scene.configureJournal;
  h.scene.configureJournal=()=>{throw new Error('canvas initialization failed');};
  await h.controller.enter({},0);
  assert.equal(h.controller.$session.get().availability,'error');
  assert.equal(h.controller.$session.get().busy,false);
  assert.match(h.controller.$session.get().error,/canvas initialization failed/);
  h.controller.escape();assert.deepEqual(h.calls.at(-1),['exit']);
  h.scene.configureJournal=configure;await h.controller.retry();
  assert.equal(h.controller.$session.get().availability,'ready');
  assert.equal(h.controller.$session.get().phase,'reading');
});
