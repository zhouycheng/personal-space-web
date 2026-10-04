import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { mergeIndexed } from '../src/presentation/scene/studio/indexedGeometry.ts';
import { createLeafDetails,emptyLeaves } from '../src/presentation/scene/studio/leafDetails.ts';
import { packSceneGeometry,unpackSceneGeometry,sceneGeometryTransfers,disposePreparedGeometry } from '../src/presentation/scene/studio/sceneGeometryData.ts';

test('indexed merging preserves the full transformed triangle stream, seams and custom attributes',()=>{
  const a=new THREE.BoxGeometry(),b=new THREE.SphereGeometry(1,16,8).toNonIndexed();
  for(const g of [a,b])g.setAttribute('windWeight',new THREE.Float32BufferAttribute(Array.from({length:g.attributes.position.count},(_,i)=>i*.001),1));
  const objects=[{geometry:a,matrix:new THREE.Matrix4().makeRotationY(.37)},{geometry:b,matrix:new THREE.Matrix4().makeScale(.7,1.2,.9)}];
  const expected=objects.map(o=>(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix));
  const merged=mergeIndexed(objects),expanded=merged.toNonIndexed();
  for(const name of Object.keys(expanded.attributes))assert.deepEqual([...expanded.getAttribute(name).array],expected.flatMap(g=>[...g.getAttribute(name).array]));
  assert.ok(merged.attributes.position.count<expanded.attributes.position.count);
  assert.ok(a.index,'source index is retained');
  for(const g of [a,b,...expected,merged,expanded])g.dispose();
});

function leaves(segments,columns) {
  const l=emptyLeaves();
  for(let seed=1;seed<=3;seed++){
    const offset=l.positions.length/3;l.blades.push({offset,segments,columns});
    for(let y=0;y<=segments;y++)for(let x=0;x<columns;x++){
      l.positions.push(x*.07,y*.12,(x*x+y*y*seed)*.0007);l.colors.push(.1*seed,.2,.3);l.anchors.push(0,0,0);l.uvs.push(x/(columns-1),y/segments);
      if(y<segments&&x<columns-1){const a=offset+y*columns+x,b=a+columns;l.indices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  return l;
}

test('cached leaf topology retains the pre-optimization indices and interpolation errors',()=>{
  // Captured from the original algorithm on three curved leaves per grid, before optimization.
  const cases=[{segments:8,columns:5,errors:[0,.0014000000000000123,.005600000000000008],hashes:['faed2cf23d49e64ee47d53526f58f1b2fb4f019b01960041c9a575b6db1431d7','bbffc2c66cdd550afefbe815fc82e9e00f871d014d49f3c0f73dfdcea10b3f79','92483254cb733d10aef817a1a5ef7270667cb3c5f64f85e5cccd37bb9a212e37']},
    {segments:22,columns:9,errors:[0,.005600000000000049,.02240000000000003],hashes:['1a1ec4a7289b305e3d077da7e5fe0bf96f5884319cbe62ecc9fc9b4a6eeda9f2','e15bd0b66037941acbce31062e5285243547ffe1365af9753a9d5758058de586','2a26a80b290c5312bc03808dfc484e62641aecbd6d8f71b74ee3ee199915317c']}];
  for(let repeat=0;repeat<2;repeat++)for(const c of cases)for(const [i,{geometry,error}] of createLeafDetails(leaves(c.segments,c.columns)).entries()){
    assert.equal(error,c.errors[i]);assert.equal(createHash('sha256').update(Buffer.from(geometry.index.array.buffer)).digest('hex'),c.hashes[i]);geometry.dispose();
  }
});

test('worker transport transfers shared LOD buffers once and restores bounds and attributes',()=>{
  const details=createLeafDetails(leaves(8,5)),make=()=>new THREE.BoxGeometry();
  const source={sand:make(),water:make(),rocks:make(),vegetation:{trunkGeometry:make(),stemGeometry:make(),details:[details]}};
  const bounds=details[0].geometry.boundingSphere.clone();
  const packet=packSceneGeometry(source),transfers=sceneGeometryTransfers(packet),count=details[0].geometry.attributes.position.count;
  assert.equal(new Set(transfers).size,transfers.length);
  const cloned=structuredClone(packet,{transfer:transfers});assert.ok(transfers.every(buffer=>buffer.byteLength===0));
  const result=unpackSceneGeometry(cloned),levels=result.vegetation.details[0];
  assert.equal(levels[0].geometry.attributes.position.count,count);
  assert.equal(levels[0].geometry.attributes.position,levels[2].geometry.attributes.position);
  assert.ok(levels[0].geometry.boundingSphere.equals(bounds));assert.equal(levels[2].error,details[2].error);
  disposePreparedGeometry(source);disposePreparedGeometry(result);
});

test('merging large indexed geometry promotes the destination index without overflow',()=>{
  const source=new THREE.PlaneGeometry(2,2,255,255),matrix=new THREE.Matrix4();
  const merged=mergeIndexed([{geometry:source,matrix},{geometry:source,matrix}]);
  assert.ok(merged.index.array instanceof Uint32Array);
  assert.equal(merged.index.getX(merged.index.count-1),source.index.getX(source.index.count-1)+source.attributes.position.count);
  source.dispose();merged.dispose();
});
