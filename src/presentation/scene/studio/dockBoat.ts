import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StudioPrimitives } from './studioPrimitives.ts';
import { createWorkspaceMaterials } from './workspaceMaterials.ts';
import { stepSpring } from '../../../animation/studio/spring.ts';
import { islandLeisure } from '../../../config/islandLeisure.ts';
import { oceanHeight } from '../../../animation/studio/oceanSurface.ts';

export const boatWidth=(u:number)=>.60*Math.sin(Math.PI*u/2)**.65*(1-.28*u**4);
export function boatHullPoint(u:number,s:number,inside=false) {
  const width=boatWidth(u),rise=.12*(1-u)**3+.015*u*u;
  return new THREE.Vector3(-1.65+u*3.3,
    (inside?-.125:-.20)+(.54-(inside?.075:0))*Math.abs(s)**2.4+rise,
    s*Math.max(0,width-(inside?.035:0)));
}

export function createDockBoat(p:StudioPrimitives,materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const group=new THREE.Group();group.name='moored-rowboat';
  const inverse=new THREE.Matrix4();
  const hull=new THREE.Group();group.add(hull);
  const d=islandLeisure.dock,cx=d.end-islandLeisure.boat.offsetFromEnd,cz=d.z+d.width/2+islandLeisure.boat.sideGap;
  const {timber,cork}=createWorkspaceMaterials(materials,textures);
  const paint=p.material(0xc9c5b4,.77),inside=p.material(0xb3ae98,.88),metal=p.material(0x484942,.56);
  paint.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vHull;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHull=position;');
    shader.fragmentShader='varying vec3 vHull;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float joint=pow(.5+.5*cos((vHull.y+.06)*82.),24.);
      diffuseColor.rgb*=1.-.10*(1.-smoothstep(-.08,.06,vHull.y));
      float wear=sin(vHull.x*113.+sin(vHull.y*81.))*sin(vHull.z*97.);
      diffuseColor.rgb*=(1.-.055*joint+.016*wear)*mix(.74,1.,smoothstep(-.14,.015,vHull.y));`);
  };
  function surface(inner:boolean) {
    const pos:number[]=[],uv:number[]=[],indices:number[]=[],rows=56,cols=28;
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      const u=i/rows,s=j/cols*2-1,v=boatHullPoint(u,s,inner);pos.push(v.x,v.y,v.z);uv.push(u,j/cols);
      if(i<rows&&j<cols){const a=i*(cols+1)+j,b=a+cols+1;
        indices.push(...(inner?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  p.mesh(hull,surface(false),paint,0,0,0);p.mesh(hull,surface(true),inside,0,0,0);
  const rail=(points:THREE.Vector3[],radius:number,mat:THREE.Material)=>p.mesh(hull,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,radius,8,false),mat,0,0,0);
  for(const sign of [-1,1]){
    rail(Array.from({length:57},(_,i)=>boatHullPoint(i/56,sign)),.035,paint);
    rail(Array.from({length:57},(_,i)=>boatHullPoint(i/56,sign*.91,true)),.013,timber);
  }
  rail([boatHullPoint(0,0),boatHullPoint(0,.55),boatHullPoint(0,1)],.032,paint);
  // A thick curved transom closes the broad stern, while the opposite end narrows to a stem.
  const transom=new THREE.Shape();
  const left=boatHullPoint(1,-1);transom.moveTo(left.z,left.y);
  for(let i=1;i<=28;i++){const v=boatHullPoint(1,-1+i/14);transom.lineTo(v.z,v.y);}
  transom.lineTo(left.z,left.y);
  const stern=p.mesh(hull,new THREE.ExtrudeGeometry(transom,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008}),paint,1.65,0,0);stern.rotation.y=-Math.PI/2;
  for(const u of [.22,.40,.59,.78,.92]){
    rail(Array.from({length:21},(_,j)=>boatHullPoint(u,-.9+j*.09,true).add(new THREE.Vector3(0,.018,0))),.018,timber);
  }
  for(const u of [.28,.55,.81]) {
    const rise=.12*(1-u)**3+.015*u*u;
    const x=-1.65+u*3.3,w=2*(boatWidth(u)-.035)*Math.pow((.183+.125-rise)/.465,1/2.4)*.98;
    p.rounded(hull,[.27,.055,w],[x,.21,0],timber,.012);
    for(const sign of [-1,1])p.rounded(hull,[.31,.04,.08],[x,.164,sign*(w*.5-.07)],timber,.006);
    for(const sign of [-1,1])p.cylinder(hull,.008,.004,[x,.24,sign*w*.39],metal);
  }
  for(let i=0;i<5;i++)p.rounded(hull,[2.05,.026,.055],[.33,-.004,(i-2)*.06],timber,.006);
  for(const u of [.2,.35,.5,.65,.8,.94])for(const sign of [-1,1]){
    const point=boatHullPoint(u,sign).add(new THREE.Vector3(0,-.075,sign*.007));
    const fixing=p.mesh(hull,new THREE.SphereGeometry(.018,8,6),metal,point.x,point.y,point.z);fixing.scale.set(.75,1,.35);
  }
  // Two oarlocks and a wooden oar stowed below the seats.
  for(const sign of [-1,1]){
    const point=boatHullPoint(.55,sign).add(new THREE.Vector3(0,.035,0));
    const lock=p.mesh(hull,new THREE.TorusGeometry(.037,.007,6,16,Math.PI*1.6),metal,point.x,point.y,point.z);lock.rotation.y=Math.PI/2;
  }
  const oar=p.cylinder(hull,.018,2.15,[.30,.09,.10],timber,.014);oar.rotation.z=Math.PI/2;
  p.rounded(hull,[.42,.023,.105],[-.93,.09,.10],timber,.035);
  // Rounded knees brace seats to the ribs; the stern has a separate fitted top rail.
  for(const u of [.28,.55,.81])for(const sign of [-1,1]){
    const foot=boatHullPoint(u,sign*.68,true).add(new THREE.Vector3(0,.018,0)),x=foot.x;
    rail([new THREE.Vector3(x,.176,foot.z),new THREE.Vector3(x,.13,foot.z),foot],.024,timber);
  }
  rail(Array.from({length:25},(_,i)=>new THREE.Vector3(1.65,.355+.008*Math.sin(i/24*Math.PI),boatWidth(1)*(-1+i/12))),.038,paint);
  const ropes:[THREE.BufferAttribute,THREE.BufferAttribute,THREE.Vector3,THREE.Vector3][]=[];
  for(const [u,x] of [[.08,d.start+(d.end-d.start)/4],[.94,d.end-.15]]){
    const local=boatHullPoint(u,-1),anchor=new THREE.Vector3(x,d.deck+.27,d.z+d.width*.5+.035);
    const eye=p.mesh(hull,new THREE.TorusGeometry(.023,.006,8,24),metal,local.x,local.y,local.z);eye.rotation.x=Math.PI/2;
    const geometry=new THREE.TubeGeometry(new THREE.LineCurve3(anchor,anchor.clone().add(new THREE.Vector3(1,0,0))),32,.011,6,false);
    p.mesh(group,geometry,cork,0,0,0).frustumCulled=false;
    (geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);(geometry.attributes.normal as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    ropes.push([geometry.attributes.position as THREE.BufferAttribute,geometry.attributes.normal as THREE.BufferAttribute,anchor,local]);
  }
  // All fittings share the hull's rigid motion; detail need not add a draw per fastener.
  const hullBatches=new Map<THREE.Material,THREE.Mesh[]>();
  hull.traverse(object=>{if(object instanceof THREE.Mesh&&!Array.isArray(object.material)){
    const batch=hullBatches.get(object.material)??[];batch.push(object);hullBatches.set(object.material,batch);
  }});
  hull.updateMatrixWorld(true);
  for(const [material,objects] of hullBatches){
    const parts=objects.map(object=>(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrixWorld));
    const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
    if(geometry){objects.forEach(object=>object.removeFromParent());p.mesh(hull,geometry,material,0,0,0);}
  }
  const endPoint=new THREE.Vector3(),along=new THREE.Vector3(),side=new THREE.Vector3(),up=new THREE.Vector3(),vertical=new THREE.Vector3(0,1,0);
  const circle=Array.from({length:7},(_,j)=>[Math.cos(j/6*Math.PI*2),Math.sin(j/6*Math.PI*2)]);
  const samples=Array.from({length:33},(_,i)=>({t:i/32,sag:Math.sin(Math.PI*i/32),slope:Math.PI*Math.cos(Math.PI*i/32)}));
  const heave={value:0,velocity:0},pitch={value:0,velocity:0},roll={value:0,velocity:0};
  let previousTime:number|undefined;
  function update(time:number){
    if(time===previousTime)return;
    const bow=oceanHeight(cx-1.1,cz,time),stern=oceanHeight(cx+1.1,cz,time);
    const port=oceanHeight(cx,cz-.38,time),starboard=oceanHeight(cx,cz+.38,time);
    const y=(bow+stern+port+starboard+oceanHeight(cx,cz,time)*2)/6;
    const p=Math.atan2(stern-bow,2.2),r=Math.atan2(port-starboard,.76);
    if(previousTime===undefined||time<previousTime){heave.value=y;pitch.value=p;roll.value=r;heave.velocity=pitch.velocity=roll.velocity=0;}
    else {const dt=time-previousTime;stepSpring(heave,y,dt,2.1,.8);stepSpring(pitch,p,dt,1.65,.76);stepSpring(roll,r,dt,1.45,.78);}
    previousTime=time;
    hull.position.set(cx,heave.value,cz);hull.rotation.z=pitch.value;hull.rotation.x=roll.value;
    hull.updateMatrixWorld(true);
    inverse.copy(hull.matrixWorld).invert();
    for(const [positions,normals,anchor,local] of ropes){
      endPoint.copy(local).applyMatrix4(hull.matrixWorld);
      const dx=endPoint.x-anchor.x,dy=endPoint.y-anchor.y,dz=endPoint.z-anchor.z;
      const sag=THREE.MathUtils.clamp(.12-(Math.hypot(dx,dy,dz)-1.5)*.035,.035,.14);
      for(let i=0;i<samples.length;i++){
        const sample=samples[i],t=sample.t;
        along.set(dx,dy-sag*sample.slope,dz).normalize();side.crossVectors(along,vertical);
        if(side.lengthSq()<1e-8)side.set(1,0,0);else side.normalize();
        up.crossVectors(side,along).normalize();
        for(let j=0;j<circle.length;j++){
          const [c,s]=circle[j],nx=side.x*c+up.x*s,ny=side.y*c+up.y*s,nz=side.z*c+up.z*s,index=i*7+j;
          positions.setXYZ(index,anchor.x+dx*t+nx*.011,anchor.y+dy*t-sag*sample.sag+ny*.011,anchor.z+dz*t+nz*.011);
          normals.setXYZ(index,nx,ny,nz);
        }
      }
      positions.needsUpdate=normals.needsUpdate=true;
    }
  }
  update(0);return {group,update,inverse};
}
