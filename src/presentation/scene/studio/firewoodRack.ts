import * as THREE from 'three';
import { campfireFuel } from '../../../config/islandLeisure.ts';
import { batchStaticChildren } from './staticBatches.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';
import { createSplitLogGeometry } from './campfireWood.ts';

export const rackRadius = .085, rackDeckTop = .16;
export function createFirewoodRack(p: StudioPrimitives, group: THREE.Group, wood: THREE.Material, geometries: Set<THREE.BufferGeometry>,logMaterial:THREE.Material) {
  group.userData.action = 'firewood';
  const frame = new THREE.Group(); group.add(frame);
  for (const x of [-.55, .55]) for (const z of [-.25, .25]) p.rounded(frame, [.055, .68, .055], [x, .34, z], wood, .007);
  for (const y of [.12, .64]) for (const z of [-.25, .25]) p.rounded(frame, [1.14, .05, .045], [0, y, z], wood, .005);
  for (const x of [-.48, .48]) p.rounded(frame, [.06, .08, .55], [x, .08, 0], wood, .006);
  for (let i = 0; i < 5; i++) p.rounded(frame, [1.14, .04, .105], [0, rackDeckTop - .02, (i - 2) * .11], wood, .006);
  batchStaticChildren(frame, geometries);
  const shapes=[0,1,2].map(variant=>{const geometry=createSplitLogGeometry(variant);geometry.morphAttributes={};geometries.add(geometry);return geometry;});
  const profiles:{x:number;y:number}[][]=[],logs:THREE.Group[]=[];
  const transform=new THREE.Matrix4(),point=new THREE.Vector3();
  function sectionAt(profile:{x:number;y:number}[],x:number) {
    const ys:number[]=[];
    for(let i=0;i<profile.length;i++) {
      const a=profile[i],b=profile[(i+1)%profile.length];
      if(x<Math.min(a.x,b.x)||x>Math.max(a.x,b.x)||Math.abs(a.x-b.x)<1e-8)continue;
      ys.push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));
    }
    return ys;
  }
  for(const count of [5,4,3])for(let i=0;i<count;i++) {
    const index=logs.length,variant=index%3,log=new THREE.Group();
    log.position.x=(i-(count-1)/2)*rackRadius*2;
    log.rotation.set(-Math.PI/2,[.07,-.09,.03][variant],0);log.scale.set(rackRadius,[.49,.52,.43][variant],rackRadius);
    transform.compose(new THREE.Vector3(),log.quaternion,log.scale);
    const positions=shapes[variant].getAttribute('position'),profile:{x:number;y:number}[]=[];
    let bottom=Infinity;
    for(let vertex=0;vertex<positions.count;vertex++) {
      point.fromBufferAttribute(positions,vertex).applyMatrix4(transform);bottom=Math.min(bottom,point.y);
      if(Math.abs(positions.getY(vertex))>1e-6)continue;
      if(!profile.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<1e-6))profile.push({x:point.x,y:point.y});
    }
    const cx=profile.reduce((s,p)=>s+p.x,0)/profile.length,cy=profile.reduce((s,p)=>s+p.y,0)/profile.length;
    profile.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
    log.position.y=rackDeckTop-bottom;
    for(let support=0;support<logs.length;support++)for(let sample=0;sample<=80;sample++) {
      const x=log.position.x-rackRadius+sample/80*rackRadius*2;
      const upper=sectionAt(profiles[support],x-logs[support].position.x),lower=sectionAt(profile,x-log.position.x);
      if(upper.length&&lower.length)log.position.y=Math.max(log.position.y,logs[support].position.y+Math.max(...upper)-Math.min(...lower));
    }
    log.updateMatrix();group.add(log);logs.push(log);profiles.push(profile);
  }
  const instances = shapes.map((geometry,variant) => {
    const batch = new THREE.InstancedMesh(geometry,logMaterial,4);batch.name=`firewood-logs-${variant}`;
    batch.castShadow=batch.receiveShadow=true;
    logs.filter((_,i)=>i%3===variant).forEach((log,i)=>batch.setMatrixAt(i,log.matrix));
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox(); batch.computeBoundingSphere(); group.add(batch);
    return batch;
  });
  return { group, logs, setStock(stock: number) {
    const count = Math.floor(Math.max(0, Math.min(campfireFuel.stock, stock)));
    logs.forEach((log, i) => { log.visible = i < count; });
    instances.forEach((batch,variant) => { batch.count = Math.max(0,Math.ceil((count-variant)/3)); });
  }, dispose() { instances.forEach(batch => batch.dispose()); } };
}
