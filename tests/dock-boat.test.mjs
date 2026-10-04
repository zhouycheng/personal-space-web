import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDockBoat,boatHullPoint} from '../src/presentation/scene/studio/dockBoat.ts';
import {createStudioPrimitives} from '../src/presentation/scene/studio/studioPrimitives.ts';
import {oceanHeight} from '../src/animation/studio/oceanSurface.ts';
import {islandLeisure} from '../src/config/islandLeisure.ts';
import {terrainHeight,islandHeight} from '../src/config/islandTerrain.ts';

test('shore slope is continuous across mean sea level',()=>{
  const h=.00001,left=(islandHeight(1)-islandHeight(1-h))/h,right=(islandHeight(1+h)-islandHeight(1))/h;
  assert.ok(left<-.5&&Math.abs(left-right)<.002);
});
test('moored hull follows shared water time, keeps a dry mask transform and clears the seabed',()=>{
  const mats=new Set(),geos=new Set(),textures=new Set(),room=new THREE.Group();
  const boat=createDockBoat(createStudioPrimitives({},room,mats,geos,textures),mats,textures);
  const d=islandLeisure.dock,x=d.end-islandLeisure.boat.offsetFromEnd,z=d.z+d.width/2+islandLeisure.boat.sideGap,hull=boat.group.children[0];
  let previousY;
  for(let frame=0;frame<=720;frame++){
    const t=frame/60;
    boat.update(t);
    assert.ok(Math.abs(hull.position.y-oceanHeight(x,z,t))<.16,'buoyancy tracks the local sea without snapping to it');
    if(previousY!==undefined)assert.ok(Math.abs(hull.position.y-previousY)<.012,'heave is continuous');
    previousY=hull.position.y;
    const local=new THREE.Vector3(.2,.15,.1),world=local.clone().applyMatrix4(hull.matrixWorld);
    assert.ok(world.clone().applyMatrix4(boat.inverse).distanceTo(local)<1e-9);
    for(const u of [.05,.25,.5,.75,.95]){const keel=boatHullPoint(u,0).applyMatrix4(hull.matrixWorld);assert.ok(keel.y>terrainHeight(keel.x,keel.z),`keel touches sand at ${u}, time ${t}: ${keel.toArray()}, terrain ${terrainHeight(keel.x,keel.z)}`);}
    const before=hull.matrixWorld.clone();boat.update(t);assert.ok(hull.matrixWorld.equals(before));
  }
  assert.equal(room.children.length,0);
  for(const resource of [...mats,...geos,...textures])resource.dispose();
});
