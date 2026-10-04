import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createZoomPicker} from '../src/presentation/interaction/studio/zoomPicking.ts';

test('dense zoom picking retains native hits, material sides, transforms, visibility and source geometry',()=>{
  for(const indexed of [true,false]) {
    const original=new THREE.SphereGeometry(2,96,64);
    const geometry=indexed?original:original.toNonIndexed();
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,[material,material]);
    geometry.clearGroups();const count=geometry.index?.count??geometry.attributes.position.count;
    geometry.addGroup(0,count/2,0);geometry.addGroup(count/2,count/2,1);
    mesh.position.set(2,1,-1);mesh.rotation.set(.2,.8,.1);mesh.scale.set(1,.7,1.2);mesh.updateMatrixWorld(true);
    const picker=createZoomPicker([mesh]),positions=geometry.attributes.position.array.slice(),drawRange={...geometry.drawRange};
    const ray=new THREE.Raycaster();
    const compare=()=>{
      const expected=ray.intersectObject(mesh,false)[0],actual=picker.intersect(ray);
      assert.equal(Boolean(actual),Boolean(expected));
      if(expected){assert.equal(actual.object,mesh);assert.ok(actual.point.distanceTo(expected.point)<1e-8);assert.equal(actual.faceIndex,expected.faceIndex);}
    };
    for(const side of [THREE.FrontSide,THREE.BackSide,THREE.DoubleSide]){
      material.side=side;
      for(let i=0;i<30;i++){
        ray.set(new THREE.Vector3(Math.sin(i)*7,1+Math.cos(i*.7)*4,Math.cos(i)*7),new THREE.Vector3());
        ray.ray.direction.copy(mesh.position).sub(ray.ray.origin).normalize();compare();
      }
    }
    mesh.visible=false;assert.equal(picker.intersect(ray),undefined);mesh.visible=true;
    mesh.layers.set(1);assert.equal(picker.intersect(ray),undefined);mesh.layers.set(0);
    assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.drawRange,drawRange);
    geometry.translate(.5,0,0);geometry.computeBoundingSphere();compare();
    geometry.setDrawRange(0,count/2);compare();
    picker.dispose();geometry.dispose();if(!indexed)original.dispose();material.dispose();
  }
});
