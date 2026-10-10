import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { createRecordPlayer } from '../src/presentation/scene/studio/recordPlayer.ts';
import { readMusicPreferences } from '../src/infrastructure/client/musicPreferences.ts';

test('record player stops, resumes without hidden-time jumps and respects reduced motion', () => {
  const root=new THREE.Group();
  const material=()=>new THREE.MeshStandardMaterial();
  const mesh=(parent,geometry,mat,x,y,z)=>{const object=new THREE.Mesh(geometry,mat);object.position.set(x,y,z);parent.add(object);return object;};
  const box=(parent,size,at,mat)=>mesh(parent,new THREE.BoxGeometry(...size),mat,...at);
  const primitives={material,mesh,box,rounded:box,chrome:material(),rubber:material(),brass:material(),
    cylinder:(parent,r,h,at,mat)=>mesh(parent,new THREE.CylinderGeometry(r,r,h),mat,...at),
    label:(parent,_text,w,h,at)=>mesh(parent,new THREE.PlaneGeometry(w,h),material(),...at)};
  const player=createRecordPlayer(root,primitives,material());
  const deck=root.children[0].children.find(o=>o instanceof THREE.Group);
  const [disc,arm]=deck.children.filter(o=>o instanceof THREE.Group);
  player.tick(0,false);assert.equal(player.tick(16,false).moving,false);
  player.setPlaying(true);player.tick(32,false);player.tick(48,false);
  assert.ok(disc.rotation.y>0);assert.ok(arm.rotation.y<0);
  player.setPlaying(false);const stopped=disc.rotation.y;player.tick(64,false);assert.equal(disc.rotation.y,stopped);
  player.setPlaying(true);player.pause();player.tick(10000,false);assert.equal(disc.rotation.y,stopped);
  assert.equal(player.tick(10016,true).moving,false);assert.equal(disc.rotation.y,stopped);assert.equal(arm.rotation.y,-.65);
  player.setPlaying(false);player.tick(10032,true);assert.equal(arm.rotation.y,0);
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();o.material.dispose();}});
});

test('music preferences tolerate denied storage and clamp invalid volume', () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{"volume":9,"id":"first"}'}});
    assert.deepEqual(readMusicPreferences(),{id:'first',volume:1});
    globalThis.localStorage.getItem=()=>'{broken';assert.equal(readMusicPreferences().volume,.35);
    globalThis.localStorage.getItem=()=>{throw Error('denied');};assert.equal(readMusicPreferences().volume,.35);
  } finally {if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('profile subscribes only on visible desktop home and shows only current activity', async () => {
  const source = readFileSync(new URL('../src/presentation/ui/music/homeProfile.ts', import.meta.url), 'utf8')
    .replace(/import \{ subscribeActivity \}[^;]+;/, 'const subscribeActivity = listener => window.subscribeProfileFixture(listener);')
    .replace('../../../justin-kit/runtime/elementActivity', new URL('../src/justin-kit/runtime/elementActivity.ts', import.meta.url).href)
    .replace('../../../application/activity/canvasActivity', new URL('../src/application/activity/canvasActivity.ts', import.meta.url).href);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const { createHomeProfile } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const original = { window: globalThis.window, document: globalThis.document, MutationObserver: globalThis.MutationObserver, matchMedia: globalThis.matchMedia };
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false });
  const media = Object.assign(new EventTarget(), { matches: false });
  let changed, update, hidden = true, active = 0, opened = 0;
  const label = { hidden: true }, bubble = label, root = { dataset: {}, isConnected: true, parentElement: null,
    closest: () => hidden ? root : null, querySelector: () => label };
  win.subscribeProfileFixture = listener => { active++; opened++; update = listener; listener({ status: 'loading' }); return () => { active--; }; };
  Object.assign(globalThis, { window: win, document: doc, matchMedia: () => media,
    MutationObserver: class { constructor(callback) { changed = callback; } observe() {} disconnect() {} } });
  try {
    const stop = createHomeProfile(root);
    assert.equal(active, 0);
    hidden = false; changed();
    assert.equal(active, 1); assert.equal(root.dataset.visible, 'true');
    assert.equal(bubble.hidden, true); assert.equal(label.textContent, '');
    update({ status: 'ready', snapshot: { appName: 'Codex', text: '一起搬砖中', expiresAt: Date.now() + 60000 } });
    assert.equal(label.textContent, '一起搬砖中'); assert.equal(bubble.hidden, false);
    update({ status: 'ready', snapshot: { appName: 'Safari', text: '高强度冲浪中', expiresAt: Date.now() + 60000 } });
    assert.equal(label.textContent, '高强度冲浪中');
    update({ status: 'ready', snapshot: null });
    assert.equal(label.textContent, ''); assert.equal(bubble.hidden, true);
    update({ status: 'ready', snapshot: { appName: 'Safari', text: '高强度冲浪中', expiresAt: Date.now() + 60000 } });
    assert.equal(bubble.hidden, false);
    update({ status: 'error' }); assert.equal(label.textContent, ''); assert.equal(bubble.hidden, true);
    update({ status: 'ready', snapshot: { appName: 'Codex', text: '一起搬砖中', expiresAt: Date.now() - 1 } });
    assert.equal(bubble.hidden, true); assert.equal(label.title, '');
    update({ status: 'ready', snapshot: { appName: 'Codex', text: '一起搬砖中', expiresAt: Date.now() + 60000 } });
    assert.equal(bubble.hidden, false); assert.equal(label.textContent, '一起搬砖中');
    update({ status: 'loading' }); assert.equal(bubble.hidden, true);
    media.matches = true; media.dispatchEvent(new Event('change'));
    assert.equal(active, 0); assert.equal(root.dataset.visible, 'false');
    media.matches = false; media.dispatchEvent(new Event('change'));
    assert.equal(active, 1);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(active, 0);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(active, 1);
    hidden = true; changed(); assert.equal(active, 0);
    stop(); hidden = false; media.dispatchEvent(new Event('change'));
    assert.equal(opened, 3); assert.equal(active, 0);
  } finally { Object.assign(globalThis, original); }
});
