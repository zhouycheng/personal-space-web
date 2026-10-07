import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { marineLife, marineReefs } from '../src/config/marineLife.ts';
import { marinePose } from '../src/animation/studio/marineMotion.ts';
import { coastRadius, terrainHeight, islandRocks } from '../src/config/islandTerrain.ts';
import { islandAppearance } from '../src/config/islandAppearance.ts';
import { createMarineAnimal } from '../src/presentation/scene/studio/marineGeometry.ts';
import { createMarineEnvironment } from '../src/presentation/scene/studio/marineEnvironment.ts';
import { oceanHeight } from '../src/animation/studio/oceanSurface.ts';

test('reef fish stay submerged and the offshore shark follows the surface, with clear routes',()=>{
  for(const kind of ['school','shark','turtle']) {
    const geometry=createMarineAnimal(kind);geometry.computeBoundingBox();
    const box=geometry.boundingBox;
    const tail=marineLife[kind].length*.06;
    for(let t=0;t<=marineLife[kind].period;t+=.25) {
      for(let g=0;g<(kind==='school'?3:1);g++) for(let i=0;i<(kind==='school'?12:1);i++) {
        const p=marinePose(kind,t,g,i),c=Math.cos(p.heading),s=Math.sin(p.heading);
        assert.ok(Number.isFinite(p.heading));
        for(const x of [box.min.x,0,box.max.x]) for(const z of [box.min.z-tail,0,box.max.z+tail]) {
          const wx=p.x+x*c+z*s,wz=p.z-x*s+z*c;
          assert.ok(coastRadius(wx,wz)>1.04,`${kind} reaches shore at ${t}`);
          assert.ok(p.y+box.min.y>terrainHeight(wx,wz)+.04,`${kind} reaches bed at ${t}`);
          assert.ok(!(wx>6&&wz>-.1&&wz<4),`${kind} enters landing`);
          for(const rock of [...islandRocks,...marineReefs]) {
            const dx=wx-rock.x,dz=wz-rock.z,rc=Math.cos(rock.rotation),rs=Math.sin(rock.rotation);
            const distance=Math.hypot((dx*rc+dz*rs)/(rock.width*1.3+.06),(-dx*rs+dz*rc)/(rock.depth*1.3+.06));
            assert.ok(distance>1,`${kind} reaches reef ${rock.seed} at ${t}`);
          }
        }
        if(kind==='shark') {
          assert.ok(coastRadius(p.x,p.z)>6,'shark stays in the distant sea');
          assert.ok(Math.abs(p.y-oceanHeight(p.x,p.z,t)+marineLife.shark.depth)<1e-8);
        }else assert.ok(p.y+box.max.y+(kind==='turtle'?marineLife.turtle.length*.09:0)<islandAppearance.seaLevel-.25,`${kind} breaches trough`);
      }
    }
    if(kind!=='school') {
      const a=marinePose(kind,0),b=marinePose(kind,marineLife[kind].period);
      for(const key of kind==='shark'?['x','z','heading']:['x','y','z','heading'])assert.ok(Math.abs(a[key]-b[key])<1e-8,`${kind} loop seam`);
    }
    geometry.dispose();
  }
});

test('marine content is batched, deterministic, excluded from picking and owned for disposal',()=>{
  const materials=new Set(),geometries=new Set();
  const marine=createMarineEnvironment(materials,geometries);
  assert.equal(marineReefs.length,10);
  assert.equal(marine.group.children.filter(o=>o.isInstancedMesh).reduce((n,o)=>n+o.count,0),36);
  let triangles=0,calls=0,releases=0;
  marine.group.traverse(o=>{
    if(!o.isMesh)return;
    assert.ok(o.userData.excludeZoom);assert.equal(o.castShadow,false);assert.ok(geometries.has(o.geometry));
    assert.ok(materials.has(o.material));
    const passes=Number(o.layers.isEnabled(0))+Number(o.layers.isEnabled(1));
    if(o.name==='marine-horizon-islands') {
      assert.equal(passes,1);assert.equal(o.layers.isEnabled(1),false);
      assert.ok(o.geometry.index.count/3<=4000);
      return;
    }
    triangles+=o.geometry.index.count/3*(o.count??1)*passes;calls+=passes;
  });
  assert.ok(triangles<=60000,`${triangles} triangles`);assert.ok(calls<=20);
  const shark=marine.group.getObjectByName('marine-shark');
  marine.update(12);const point=shark.position.clone();marine.update(12);
  assert.ok(shark.position.equals(point));marine.update(0);assert.ok(!shark.position.equals(point));
  marine.dispose();marine.dispose();
  for(const resource of [...materials,...geometries]){resource.addEventListener('dispose',()=>releases++);resource.dispose();}
  assert.equal(releases,materials.size+geometries.size);
});

test('a failed underwater draw restores renderer state and releases its target',()=>{
  const materials=new Set(),geometries=new Set(),marine=createMarineEnvironment(materials,geometries);
  const scene=new THREE.Scene();scene.add(marine.group);
  const camera=new THREE.PerspectiveCamera();
  let current=null,captured;
  const renderer={
    domElement:{clientWidth:1440},extensions:{has:()=>false},shadowMap:{enabled:true},toneMapping:THREE.ACESFilmicToneMapping,
    getDrawingBufferSize:v=>v.set(2160,1350),getRenderTarget:()=>current,
    setRenderTarget:t=>{current=t;if(t)captured=t;},getClearAlpha:()=>.5,getClearColor:c=>c.setHex(0x112233),setClearColor:()=>{},
    render:()=>{throw new Error('test draw failure');},
  };
  assert.throws(()=>marine.render(renderer,scene,camera),/test draw failure/);
  assert.equal(camera.layers.mask,1);assert.equal(current,null);
  assert.equal(renderer.shadowMap.enabled,true);assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);
  assert.equal(captured.width,1280);assert.equal(captured.height,800);
  let released=0;captured.addEventListener('dispose',()=>released++);
  marine.dispose();marine.dispose();assert.equal(released,1);
  for(const resource of [...materials,...geometries])resource.dispose();
});
