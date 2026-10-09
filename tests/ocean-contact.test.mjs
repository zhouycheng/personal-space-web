import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {shoreWash,oceanHeight} from '../src/animation/studio/oceanSurface.ts';
import {rockSectionSamples,ROCK_SECTION_ANGLES as angles,ROCK_SECTION_LEVELS as levels,ROCK_SECTION_BOTTOM as bottom,ROCK_SECTION_TOP as top} from '../src/presentation/scene/studio/rockContact.ts';
import {createRockGeometry,rockContacts,createRockContactTexture} from '../src/presentation/scene/studio/islandRocks.ts';
import {islandAppearance as island} from '../src/config/islandAppearance.ts';
import {shoreRadius} from '../src/config/islandTerrain.ts';

test('shore wash has consistent spatial/temporal derivatives and changes the shoreline water height',()=>{
  const h=.00001;
  for(const t of [0,1,4,8,15])for(const [x,z] of [[0,0],[-6,2],[4,5]]) {
    const wash=shoreWash(x,z,t);
    for(const [i,a,b] of [[1,shoreWash(x+h,z,t)[0],shoreWash(x-h,z,t)[0]],[2,shoreWash(x,z+h,t)[0],shoreWash(x,z-h,t)[0]],[3,shoreWash(x,z,t+h)[0],shoreWash(x,z,t-h)[0]]])
      assert.ok(Math.abs(wash[i]-(a-b)/(2*h))<1e-8);
  }
  const x=island.radiusX*shoreRadius(0),z=island.centerZ;
  assert.ok(Math.abs(oceanHeight(x,z,0)-oceanHeight(x,z,4))>.04);
  assert.ok(Math.abs(oceanHeight(x,z,0)-island.seaLevel-shoreWash(x,z,0)[0])<1e-8);
});

test('rock slices exist only where the actual mesh meets the water and close at the angle seam',()=>{
  const cases=[{y:1,expect:false},{y:-2,expect:false},{y:-.28,expect:true}];
  for(const {y,expect} of cases) {
    const geometry=new THREE.BoxGeometry(.6,.3,.8);geometry.translate(0,y,0);
    const samples=rockSectionSamples(geometry,{x:0,z:0,rotation:0});
    const middle=(levels-1)/2*(angles+1)*4;
    assert.equal(samples[middle+3]>0,expect);
    if(expect){assert.ok(Math.abs(samples[middle+2]-.3)<1e-6);assert.equal(samples[middle+2],samples[middle+angles*4+2]);}
    for(let row=0;row<levels;row++){
      const plane=bottom+(top-bottom)*row/(levels-1),present=samples[row*(angles+1)*4+3];
      if(plane<y-.15||plane>y+.15)assert.ok(present<=0);
    }
    geometry.dispose();
  }
});

test('authored rock section samples meet real triangles rather than a scaled footprint',()=>{
  const ray=new THREE.Raycaster(),errors=[];
  for(const rock of rockContacts()) {
    const geometry=createRockGeometry([rock],rock.seed>=901?2:undefined),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
    const samples=rockSectionSamples(geometry,rock),c=Math.cos(rock.rotation),s=Math.sin(rock.rotation);
    for(const row of [6,12,16,20,26])for(let angle=0;angle<angles;angle+=4) {
      const offset=(row*(angles+1)+angle)*4;if(samples[offset+3]<=0)continue;
      const [cx,cz,radius]=samples.slice(offset,offset+3),theta=angle/angles*Math.PI*2;
      const dx=Math.cos(theta)*c-Math.sin(theta)*s,dz=Math.cos(theta)*s+Math.sin(theta)*c;
      const center=new THREE.Vector3(rock.x+cx*c-cz*s,bottom+(top-bottom)*row/(levels-1),rock.z+cx*s+cz*c);
      ray.set(center.clone().addScaledVector(new THREE.Vector3(dx,0,dz),radius+1),new THREE.Vector3(-dx,0,-dz));
      const hit=ray.intersectObject(mesh)[0];assert.ok(hit,`missing slice ${rock.seed}`);
      errors.push(Math.abs(hit.distance-1));
    }
    // Sample between atlas rows/angles, including half-float quantization, against real triangles.
    const half=Float32Array.from(samples,value=>THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(value)));
    const lookup=(row,angle,channel)=>{
      const lo=Math.floor(row),a=Math.floor(angle),fy=row-lo,fx=angle-a;
      const at=(r,k)=>half[(r*(angles+1)+k)*4+channel];
      return (at(lo,a)*(1-fx)+at(lo,a+1)*fx)*(1-fy)+(at(lo+1,a)*(1-fx)+at(lo+1,a+1)*fx)*fy;
    };
    for(const row of [6.5,12.5,16.5,20.5,26.5])for(let angle=.5;angle<angles;angle+=4) {
      if(lookup(row,0,3)<.03)continue;
      const cx=lookup(row,0,0),cz=lookup(row,0,1),radius=lookup(row,angle,2),theta=angle/angles*Math.PI*2;
      const direction=new THREE.Vector3(Math.cos(theta)*c-Math.sin(theta)*s,0,Math.cos(theta)*s+Math.sin(theta)*c);
      const center=new THREE.Vector3(rock.x+cx*c-cz*s,bottom+(top-bottom)*row/(levels-1),rock.z+cx*s+cz*c);
      ray.set(center.addScaledVector(direction,radius+1),direction.clone().negate());
      const hit=ray.intersectObject(mesh)[0];assert.ok(hit);
      assert.ok(Math.abs(hit.distance-1)<.06,`interpolated contact error ${rock.seed}: ${Math.abs(hit.distance-1)}`);
    }
    geometry.dispose();material.dispose();
  }
  assert.ok(Math.max(...errors)<.0001,`section error ${Math.max(...errors)}`);
  const texture=createRockContactTexture();
  assert.ok(texture.image.data.byteLength<512*1024,'bounded lookup, no render target');
  const baked=gunzipSync(readFileSync(new URL('../src/content/scene/rock-sections.bin.gz',import.meta.url)));
  assert.deepEqual(baked,Buffer.from(texture.image.data.buffer),'Run npm run ocean:build after changing rock geometry or contact sampling');
  texture.dispose();
});
