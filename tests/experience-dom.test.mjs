import test from 'node:test';
import assert from 'node:assert/strict';
import {createDomInstances} from '../src/justin-kit/runtime/domInstances.ts';
import {createWindowGestureController} from '../src/justin-kit/components/macos-desktop/runtime/windowGestures.js';

test('DOM additions scan only new roots and preserve reparented instances',()=>{
  const original={document:globalThis.document,window:globalThis.window,Element:globalThis.Element,HTMLElement:globalThis.HTMLElement,MutationObserver:globalThis.MutationObserver};
  class Element {isConnected=true;parentElement=null;children=[];scans=0;matches(){return true;}querySelectorAll(){this.scans++;return this.children;}}
  const first=new Element(),added=new Element(),child=new Element();added.children=[child];child.parentElement=added;
  let scans=0,callback,created=0,disposed=0;
  Object.assign(globalThis,{Element,HTMLElement:Element,window:new EventTarget(),document:Object.assign(new EventTarget(),{documentElement:{},readyState:'complete',querySelectorAll(){scans++;return [first];}}),MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}}});
  try{
    const registry=createDomInstances('[fixture]',()=>{created++;return()=>disposed++;});registry.init();
    callback([{addedNodes:[added,child]}]);assert.equal(created,3);assert.equal(added.scans,1);assert.equal(child.scans,0);assert.equal(scans,1);
    callback([{addedNodes:[first]}]);assert.equal(created,3);assert.equal(disposed,0);
    first.isConnected=false;callback([{addedNodes:[]}]);assert.equal(disposed,1);registry.destroy();assert.equal(disposed,3);
  }finally{Object.assign(globalThis,original);}
});

test('window drag composites during motion and commits the pointer-up position once',()=>{
  const original={document:globalThis.document,window:globalThis.window,Element:globalThis.Element};
  const win=new EventTarget(),frames=new Map();let id=0,writes=0;
  win.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};win.cancelAnimationFrame=n=>frames.delete(n);
  Object.assign(globalThis,{window:win,Element:class{},document:{body:{classList:{add(){},remove(){}}}}});
  const state={id:'a',left:20,top:30,width:300,height:200,el:{style:{translate:'',willChange:''}},entry:{window:{minWidth:100,minHeight:100}}};
  try{
    const gestures=createWindowGestureController({focusWindow(){},openWindows:new Map([['a',state]]),applyWindowFrame(s,f){writes++;Object.assign(s,{left:f.left,top:f.top,width:f.width,height:f.height});},clampWindowFrame:f=>f,saveWindowSize(){}});
    gestures.startDrag({button:0,target:null,pointerId:1,clientX:50,clientY:50,preventDefault(){}},state);
    const dispatch=(type,x,y)=>{const e=new Event(type);Object.assign(e,{pointerId:1,clientX:x,clientY:y});win.dispatchEvent(e);};
    dispatch('pointermove',80,90);for(const [id,fn] of frames){frames.delete(id);fn();}
    assert.equal(writes,0);assert.equal(state.el.style.translate,'30px 40px');
    dispatch('pointerup',95,100);assert.equal(writes,1);assert.equal(state.left,65);assert.equal(state.top,80);assert.equal(state.el.style.translate,'');assert.equal(state.el.style.willChange,'');assert.equal(frames.size,0);
    gestures.cancel();assert.equal(writes,1);
  }finally{Object.assign(globalThis,original);}
});
