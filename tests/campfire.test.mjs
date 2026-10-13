import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import sharp from 'sharp';
import { createCampfireController, campfireHeat } from '../src/application/studio/campfire.ts';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createFirewoodRack, rackDeckTop } from '../src/presentation/scene/studio/firewoodRack.ts';
import { campfireLogPoses, createCampfireLogs } from '../src/presentation/scene/studio/campfireLogs.ts';
import { createCampfireWood, createSplitLogGeometry } from '../src/presentation/scene/studio/campfireWood.ts';
import { createCampfireFlame } from '../src/presentation/scene/studio/campfireFlame.ts';
import { createIslandLeisure } from '../src/presentation/scene/studio/islandLeisure.ts';
import { createStudioPicker } from '../src/presentation/interaction/studio/pickObject.ts';
import { createStudioHover } from '../src/presentation/interaction/studio/sceneHover.ts';

test('each activation adds one log; full and empty requests never consume stock', () => {
  const fire=createCampfireController(); assert.equal(fire.view().burning,3);
  const before=fire.view().heat;
  for(let i=0;i<4;i++){assert.equal(fire.addFirewood(),'added');assert.equal(fire.snapshot().stock,11-i);assert.equal(fire.view().burning,4+i);}
  assert.equal(fire.view().heat,before,'fresh wood does not flash brighter');
  assert.equal(fire.addFirewood(),'full');assert.equal(fire.snapshot().stock,8);
  fire.step(4);const halfway=fire.view().heat;fire.step(4);assert.ok(fire.view().heat>halfway&&halfway>before);
  fire.restore({stock:0,refillElapsed:0,logs:Array(7).fill(null)});
  assert.equal(fire.addFirewood(),'empty');assert.equal(fire.snapshot().stock,0);
});

test('refill has a ten-second cadence and full storage cannot bank time', () => {
  const fire=createCampfireController();fire.step(500);fire.addFirewood();fire.step(9);
  assert.equal(fire.snapshot().stock,11);fire.step(1);assert.equal(fire.snapshot().stock,12);assert.equal(fire.snapshot().refillElapsed,0);
  fire.addFirewood();fire.addFirewood();fire.step(25);assert.equal(fire.snapshot().stock,12);assert.equal(fire.snapshot().refillElapsed,0);
  fire.restore({stock:0,refillElapsed:0,logs:Array(7).fill(null)});
  fire.step(35);assert.equal(fire.snapshot().stock,3);assert.equal(fire.snapshot().refillElapsed,5);
  fire.step(1000);assert.equal(fire.snapshot().stock,12);assert.equal(fire.snapshot().refillElapsed,0);
});

test('each ignited log visibly expands the flame and full fuel stays distinct from three logs',()=>{
  const root=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const p=createStudioPrimitives({},root,materials,geometries,textures),flame=createCampfireFlame(p,root,materials,textures,geometries);
  const fire=createCampfireController(),geometry=flame.renderer.batches[0].geometry;
  const measure=()=>{flame.setHeat(fire.view().heat);const size=geometry.getAttribute('size'),color=geometry.getAttribute('color');return {width:size.getX(0),height:size.getY(0),sideAlpha:color.getW(1)};};
  const initial=measure();fire.addFirewood();assert.deepEqual(measure(),initial);
  fire.step(4);const igniting=measure();fire.step(4);const single=measure();
  assert.ok(igniting.height>initial.height&&single.height>igniting.height);
  assert.ok(single.height>initial.height*1.25&&single.width>initial.width*1.18,'one log has a visible silhouette change after ignition');
  for(let i=0;i<3;i++)fire.addFirewood();fire.step(8);const full=measure();
  assert.ok(full.height>initial.height*2.3&&full.width>initial.width*1.9);
  assert.ok(full.sideAlpha>single.sideAlpha&&single.sideAlpha>initial.sideAlpha,'side flames must not saturate at the initial fuel level');
  fire.step(180);const embers=measure();assert.ok(embers.height>0&&embers.height<initial.height*.4);
  assert.equal(geometry.instanceCount,5);flame.dispose();for(const resource of [...materials,...geometries,...textures])resource.dispose();
});

test('a log burns for 180 active seconds and charred slots are reused', () => {
  const fire=createCampfireController();fire.restore({stock:12,refillElapsed:0,logs:Array(7).fill(null)});
  fire.addFirewood();fire.step(179);assert.equal(fire.view().burning,1);assert.ok(fire.view().heat>0);
  fire.step(1);assert.equal(fire.view().burning,0);assert.equal(fire.view().heat,0);assert.equal(fire.snapshot().logs[0],180);
  fire.addFirewood();assert.equal(fire.snapshot().logs[0],0);assert.equal(fire.snapshot().logs.length,7);
  const before=fire.snapshot();fire.step(-1);fire.step(NaN);assert.deepEqual(fire.snapshot(),before);
});

test('pause and restore preserve progress without catching up hidden time', () => {
  const fire=createCampfireController();fire.addFirewood();fire.tick(1000,true);fire.tick(6000,true);const saved=fire.snapshot();
  fire.tick(10000,false);fire.tick(900000,true);assert.deepEqual(fire.snapshot(),saved);
  fire.tick(901000,true);assert.equal(fire.snapshot().logs[0],saved.logs[0]+1);
  fire.pause();fire.tick(1900000,true);assert.equal(fire.snapshot().logs[0],saved.logs[0]+1);
  const restored=createCampfireController();restored.restore(saved);saved.logs[0]=0;
  assert.notEqual(restored.snapshot().logs[0],0);restored.tick(3000000,true);restored.tick(3001000,true);
  assert.equal(restored.snapshot().refillElapsed,6);
  restored.restore({stock:-10,refillElapsed:Infinity,logs:[NaN,-8,999]});
  assert.equal(restored.snapshot().stock,0);assert.deepEqual(restored.snapshot().logs,[180,0,180,null,null,null,null]);
});

test('rack split logs share the fire material and keep their lower supports as stock changes',()=>{
  const root=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set(),p=createStudioPrimitives({},root,materials,geometries,textures);
  const wood=createCampfireWood(materials,textures),surface=wood.createSurface();
  const rack=createFirewoodRack(p,root,p.wood,geometries,surface.material);
  assert.equal(createCampfireWood(materials,textures),wood,'rack and hearth use one scene texture owner');
  const batches=root.children.filter(mesh=>mesh.isInstancedMesh),point=new THREE.Vector3();
  const meshes=rack.logs.map((log,i)=>{const mesh=new THREE.Mesh(batches[i%3].geometry,surface.material);mesh.applyMatrix4(log.matrix);mesh.updateMatrixWorld();return mesh;});
  for(let i=0;i<12;i++) {
    assert.equal(batches[i%3].material,surface.material);assert.equal(surface.burn.value,0);assert.equal(surface.heat.value,0);
    assert.deepEqual([...new Set(meshes[i].geometry.getAttribute('woodSurface').array)].sort(),[0,1,2]);
    const positions=meshes[i].geometry.getAttribute('position');let bottom=Infinity;
    for(let v=0;v<positions.count;v++)bottom=Math.min(bottom,point.fromBufferAttribute(positions,v).applyMatrix4(meshes[i].matrixWorld).y);
    assert.ok(bottom>=rackDeckTop-1e-6);
    if(i<5)assert.ok(Math.abs(bottom-rackDeckTop)<1e-6);
    else {
      const ray=new THREE.Raycaster(),contacts=new Set();
      for(let x=-.085;x<=.085;x+=.002){
        ray.set(new THREE.Vector3(rack.logs[i].position.x+x,1,0),new THREE.Vector3(0,-1,0));
        const own=ray.intersectObject(meshes[i]);if(!own.length)continue;
        // Back faces expose the bottom of the upper split log to the downward ray.
        surface.material.side=THREE.DoubleSide;const all=ray.intersectObject(meshes[i]);surface.material.side=THREE.FrontSide;
        const low=Math.min(...all.map(hit=>hit.point.y));
        for(let j=0;j<i;j++){const support=ray.intersectObject(meshes[j]);if(support.length&&Math.abs(low-support[0].point.y)<.006)contacts.add(j);}
      }
      assert.ok(contacts.size>=1,'each upper log contacts earlier stock that remains until it is removed');
    }
  }
  rack.dispose();wood.dispose();for(const resource of [...materials,...geometries,...textures])resource.dispose();
});

test('shrinking fire logs settle, retain charcoal and stay above their ground support', () => {
  let previous=campfireLogPoses(Array(7).fill(0));
  assert.ok(previous.some(pose=>Math.abs(pose.axis.y)>.1),'crossing logs tilt onto their supports');
  assert.ok(previous.every(pose=>pose.center.y+Math.abs(pose.axis.y)*pose.length*.5+pose.radius*.52<.64),'a full load stays low inside the hearth');
  for(let age=15;age<=180;age+=15){
    const next=campfireLogPoses(Array(7).fill(age));
    next.forEach((pose,i)=>{
      assert.ok(pose.center.y<=previous[i].center.y+1e-6,'the stack settles as supports shrink');
      assert.ok(pose.center.y-pose.radius*.6>=.045-1e-8);
      assert.ok(pose.radius>0&&pose.length>0,'burnt wood remains visible charcoal');
    });previous=next;
  }
  const unsupported=campfireLogPoses([null,null,0,null,null,null,null])[2];
  assert.ok(unsupported.center.y<campfireLogPoses(Array(7).fill(0))[2].center.y,'removing lower supports lowers the upper log');
});

test('wood models and lighting remain bounded across repeated burn/refill cycles', () => {
  const root=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  const p=createStudioPrimitives({},root,materials,geometries,textures),rack=createFirewoodRack(p,new THREE.Group(),p.wood,geometries,createCampfireWood(materials,textures).createSurface().material);
  const leisure=createIslandLeisure(p,materials,textures,geometries),fire=createCampfireController();
  const owned=[materials.size,geometries.size,textures.size];
  const hearth=leisure.group.getObjectByName('stone-campfire'),light=hearth.children.find(object=>object.isPointLight);
  for(let i=0;i<40;i++){
    fire.step(180);fire.addFirewood();rack.setStock(fire.snapshot().stock);leisure.updateCampfire(fire.snapshot(),fire.view().heat);fire.step(8);
    leisure.updateCampfire(fire.snapshot(),fire.view().heat);
    for(const daylight of [0,1]){leisure.setLighting(daylight);leisure.setWind(i);assert.ok(light.intensity>=.12-.04*daylight-1e-8&&light.intensity<=1.6-.6*daylight);}
  }
  fire.step(180);leisure.updateCampfire(fire.snapshot(),campfireHeat(fire.snapshot()));leisure.setLighting(0);
  assert.equal(light.intensity,.12);assert.equal(light.distance,4);
  assert.equal(leisure.fireLogs.group.children.length,7);assert.equal(rack.logs.length,12);
  for(let stock=0;stock<=12;stock++){rack.setStock(stock);assert.equal(rack.logs.filter(log=>log.visible).length,stock);}
  const batches=rack.group.children.filter(mesh=>mesh.isInstancedMesh);
  assert.equal(batches.length,3,'rack wood has three shared shape draws regardless of inventory');
  const matrix=new THREE.Matrix4();
  batches.forEach((batch,variant)=>rack.logs.filter((_,i)=>i%3===variant).forEach((log,i)=>{batch.getMatrixAt(i,matrix);assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(log.position)<1e-7);}));
  for(let stock=0;stock<=12;stock++){rack.setStock(stock);assert.equal(batches.reduce((sum,batch)=>sum+batch.count,0),stock);}
  assert.deepEqual([materials.size,geometries.size,textures.size],owned);
  for(const group of [leisure.group,rack.group])group.traverse(object=>{if(object.isMesh){assert.ok(geometries.has(object.geometry));assert.ok(materials.has(object.material));}});
  const body=leisure.fireLogs.group.getObjectByName('campfire-log-0');
  assert.equal(body.userData.burn,1);assert.equal(body.morphTargetInfluences[0],1);
  assert.ok(leisure.fireLogs.debris.count<=14);
  assert.equal(leisure.flame.renderer.batches.length,1);
  assert.equal(leisure.flame.renderer.batches[0].geometry.instanceCount,5);
  let released=0;batches.forEach(batch=>batch.addEventListener('dispose',()=>released++));rack.dispose();assert.equal(released,3);
  for(const resource of [...materials,...geometries,...textures])resource.dispose();
});

function woodFixture() {
  const root=new THREE.Group(),materials=new Set(),textures=new Set(),geometries=new Set();
  const p=createStudioPrimitives({},root,materials,geometries,textures);
  return {logs:createCampfireLogs(p,root,materials,textures,geometries),dispose(){for(const resource of [...materials,...textures,...geometries])resource.dispose();}};
}

test('rack hover keeps the split-wood shader and reuses its highlight material',()=>{
  const materials=new Set(),textures=new Set(),wood=createCampfireWood(materials,textures),surface=wood.createSurface();
  const root=new THREE.Group(),geometry=createSplitLogGeometry(0),mesh=new THREE.InstancedMesh(geometry,surface.material,1);root.add(mesh);root.userData.action='firewood';
  const mount={dataset:{}},canvas={style:{}},tooltip={style:{},hidden:true,offsetWidth:100,offsetHeight:20},abort=new AbortController();
  const hover=createStudioHover({mount,canvas,tooltip,bounds:()=>({left:0,top:0,width:300,height:200}),requestDraw(){},signal:abort.signal});
  for(let i=0;i<8;i++){
    hover.show(root,150,80);assert.equal(mesh.material.onBeforeCompile,surface.material.onBeforeCompile);assert.equal(mesh.material.customProgramCacheKey(),surface.material.customProgramCacheKey());hover.clear();assert.equal(mesh.material,surface.material);
  }
  assert.equal(mount.dataset.hoverMaterialCreated,'1');abort.abort();assert.equal(mount.dataset.hoverMaterialDisposed,'1');
  mesh.dispose();geometry.dispose();wood.dispose();for(const resource of [...materials,...textures])resource.dispose();
});

test('split wood has bark, cut faces and end grain with bounded fracture geometry',()=>{
  for(let variant=0;variant<3;variant++) {
    const geometry=createSplitLogGeometry(variant);
    assert.deepEqual([...new Set(geometry.getAttribute('woodSurface').array)].sort(),[0,1,2]);
    assert.equal(geometry.morphAttributes.position[0].count,geometry.getAttribute('position').count);
    assert.ok(geometry.getAttribute('position').count<=750);
    for(const value of geometry.morphAttributes.position[0].array)assert.ok(Number.isFinite(value));
    geometry.dispose();
  }
});

test('both flame sequences preserve transparent frame margins after atlas packing',async()=>{
  const {data,info}=await sharp(new URL('../src/content/scene/campfire/flame-atlas.png',import.meta.url).pathname).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1024);assert.equal(info.height,1024);assert.equal(info.channels,4);
  for(const top of [0,512]) {
    let edge=0,inside=0;
    for(let y=0;y<128;y++)for(let x=0;x<64;x++) {
      const alpha=data[((top+y)*1024+x)*4+3]/255;
      if(x===0||x===63)edge+=alpha;else inside+=alpha;
    }
    assert.ok(edge/256<.12,'a tile must not cut through the neighboring flame');
    assert.ok(inside/(128*62)>.08,'the flame body must remain inside its frame');
  }
});

test('successive drops preserve existing placements, settle in order and restore without replay',()=>{
  const f=woodFixture(),fire=createCampfireController();f.logs.update(fire.snapshot());
  assert.equal(f.logs.group.children.filter(mesh=>mesh.visible).length,3);
  const original=f.logs.snapshot();
  for(let i=0;i<4;i++) {fire.addFirewood();f.logs.update(fire.snapshot(),true);}
  const full=f.logs.snapshot();
  original.logs.forEach((log,i)=>{if(log)assert.deepEqual(full.logs[i],log,'new fuel cannot reposition older wood');});
  f.logs.tick(0);assert.equal(f.logs.group.children.filter(mesh=>mesh.visible).length,4);
  for(let i=0;i<40;i++)f.logs.tick(.05);
  assert.equal(f.logs.group.children.filter(mesh=>mesh.visible).length,7);
  const poses=campfireLogPoses(fire.snapshot().logs,full);
  f.logs.group.children.forEach((mesh,i)=>assert.ok(mesh.position.distanceTo(poses[i].center)<1e-8));
  fire.step(155);f.logs.update(fire.snapshot(),true);for(let i=0;i<40;i++)f.logs.tick(.05);
  assert.ok(f.logs.group.children.every(mesh=>mesh.morphTargetInfluences[0]>.5));
  const saved=f.logs.snapshot(),restored=woodFixture();restored.logs.restore(fire.snapshot(),saved);
  assert.deepEqual(restored.logs.snapshot(),saved);assert.equal(restored.logs.tick(0),false);
  const settled=campfireLogPoses(fire.snapshot().logs,saved);
  settled.forEach((pose,i)=>assert.ok(pose.center.y<=poses[i].center.y));
  fire.step(30);f.logs.update(fire.snapshot());fire.addFirewood();f.logs.update(fire.snapshot());
  assert.equal(f.logs.snapshot().charcoal.length,1);assert.equal(f.logs.debris.count,2);
  assert.ok(f.logs.snapshot().logs[0].order>saved.logs[0].order);
  restored.logs.restore(fire.snapshot(),{logs:Array(7).fill({x:NaN,z:0,angle:0,variant:0,order:0}),charcoal:[]});
  assert.ok(restored.logs.group.children.every(mesh=>Number.isFinite(mesh.position.y)));
  f.logs.dispose();restored.logs.dispose();f.dispose();restored.dispose();
});

test('the external rack can be picked while nearest solid occluders and hidden logs remain respected', () => {
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5;
  const room=new THREE.Group(),rack=new THREE.Group(),environment=new THREE.Group();rack.userData.action='firewood';
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),wood=new THREE.Mesh(geometry,material);rack.add(wood);
  const blocker=new THREE.Mesh(geometry,material);blocker.position.z=2;environment.add(blocker);
  const rect={left:0,top:0,width:100,height:100},canvas={getBoundingClientRect:()=>rect};
  const pick=createStudioPicker(canvas,camera,room,()=>true,()=>rect,[rack,environment]),event={clientX:50,clientY:50};
  assert.equal(room.children.length,0);assert.equal(pick(event),undefined);
  blocker.visible=false;assert.equal(pick(event),rack);
  wood.visible=false;assert.equal(pick(event),undefined);
  pick.dispose();
  geometry.dispose();material.dispose();
});
