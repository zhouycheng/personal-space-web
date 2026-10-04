import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoungeShell } from '../src/presentation/scene/studio/leisureGeometry.ts';
import { loungeHeightSampler, restControllerOnLounge } from '../src/presentation/scene/studio/loungeSupport.ts';
import { createStudioPrimitives } from '../src/presentation/scene/studio/studioPrimitives.ts';
import { createStudioDevices } from '../src/presentation/scene/studio/studioDevices.ts';
import { deviceSurfaceSize } from '../src/presentation/scene/studio/deviceGeometry.ts';

test('trackpad is below the palm rest, in a real opening, with screen anchors retained',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
  const room=new THREE.Group(),materials=new Set(),geometries=new Set(),textures=new Set();
  try{
    const renderer={capabilities:{getMaxAnisotropy:()=>1}},p=createStudioPrimitives(renderer,room,materials,geometries,textures);
    const devices=createStudioDevices(p,renderer,materials,textures,'Justin OS');room.updateMatrixWorld(true);
    const chassis=room.getObjectByName('laptop-recessed-chassis'),trackpad=room.getObjectByName('recessed-trackpad');
    const chassisBounds=new THREE.Box3().setFromObject(chassis),padBounds=new THREE.Box3().setFromObject(trackpad);
    assert.ok(padBounds.max.y<chassisBounds.max.y-.001);
    const computer=chassis.parent;
    const ray=new THREE.Raycaster(computer.localToWorld(new THREE.Vector3(-.2,2,-1.019)),new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObject(chassis).length,0,'The recessed panel must not hide beneath an uncut chassis');
    assert.ok(ray.intersectObject(trackpad).length>0);
    ray.ray.origin.copy(computer.localToWorld(new THREE.Vector3(-.8,2,-1.019)));
    assert.ok(ray.intersectObject(chassis).length>0,'Palm rest remains solid beside the opening');
    assert.deepEqual(devices.computerSurface.position.toArray(),[0,.457,.029]);
    const bezel=room.getObjectByName('laptop-screen-bezel');bezel.geometry.computeBoundingBox();
    assert.ok(devices.computerSurface.position.z-(bezel.position.z+bezel.geometry.boundingBox.max.z)>.006);
    assert.equal(devices.computerSurface.material.polygonOffset,true);
    devices.computerSurface.geometry.computeBoundingBox();
    const size=devices.computerSurface.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x-1.31)<1e-6&&Math.abs(size.y-.81)<1e-6);
    for(const [surface,width,height] of [[devices.computerSurface,1.31,.81],[devices.canvasSurface,.69,.49]]) {
      const actual=deviceSurfaceSize(surface.geometry);
      assert.ok(Math.abs(actual.width-width)<1e-6&&Math.abs(actual.height-height)<1e-6,'camera flight reads rounded and flat screen dimensions');
    }
  }finally{globalThis.document=previous;for(const resource of [...materials,...geometries,...textures])resource.dispose();}
});

test('controller rests above the unchanged cushion, including both grips under a rotated parent',()=>{
  const geometry=createLoungeShell(),original=geometry.attributes.position.array.slice();
  const material=new THREE.MeshStandardMaterial(),cushion=new THREE.Mesh(geometry,material),parent=new THREE.Group();
  parent.position.set(-3,.2,2);parent.rotation.y=-.32;parent.add(cushion);cushion.position.set(0,.025,-.5);
  const controller=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.25,.05,.12),material);controller.add(body);
  for(const side of [-1,1]){
    const grip=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);grip.position.set(side*.12,-.007,.03);grip.scale.set(.067,.033,.09);body.add(grip);
  }
  restControllerOnLounge(controller,cushion,.2,-.12,.2);parent.updateMatrixWorld(true);
  const height=loungeHeightSampler(geometry),inverse=cushion.matrixWorld.clone().invert(),point=new THREE.Vector3();let minimum=Infinity;
  controller.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const gap=point.y-height(point.x,point.z);assert.ok(gap>=.0039);minimum=Math.min(minimum,gap);
    }
    mesh.geometry.dispose();
  });
  assert.ok(minimum<.0041,'At least one support contact must meet the cushion instead of floating');
  assert.deepEqual(geometry.attributes.position.array,original,'Resting the controller must not reshape the sofa');
  geometry.dispose();material.dispose();
});
