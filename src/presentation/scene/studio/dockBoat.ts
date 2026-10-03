import * as THREE from 'three';
import type { StudioPrimitives } from './studioPrimitives.ts';
import { createWorkspaceMaterials } from './workspaceMaterials.ts';
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
    const x=-1.65+u*3.3,w=boatWidth(u)*1.86;
    p.rounded(hull,[.27,.055,w],[x,.21,0],timber,.012);
    for(const sign of [-1,1])p.rounded(hull,[.31,.04,.08],[x,.164,sign*(w*.5-.07)],timber,.006);
    for(const sign of [-1,1])p.cylinder(hull,.008,.004,[x,.24,sign*w*.39],metal);
  }
  for(let i=0;i<5;i++)p.rounded(hull,[2.13,.026,.105],[.33,-.094,(i-2)*.114],timber,.006);
  for(const u of [.2,.35,.5,.65,.8,.94])for(const sign of [-1,1]){
    const point=boatHullPoint(u,sign).add(new THREE.Vector3(0,-.075,sign*.007));
    const fixing=p.mesh(hull,new THREE.SphereGeometry(.018,8,6),metal,point.x,point.y,point.z);fixing.scale.set(.75,1,.35);
  }
  // Two oarlocks and a wooden oar stowed below the seats.
  for(const sign of [-1,1]){
    const point=boatHullPoint(.55,sign).add(new THREE.Vector3(0,.035,0));
    const lock=p.mesh(hull,new THREE.TorusGeometry(.037,.007,6,16,Math.PI*1.6),metal,point.x,point.y,point.z);lock.rotation.y=Math.PI/2;
  }
  const oar=p.cylinder(hull,.018,2.15,[.30,.09,.26],timber,.014);oar.rotation.z=Math.PI/2;
  p.rounded(hull,[.42,.023,.105],[-.93,.09,.26],timber,.035);
  const ropes:[THREE.BufferAttribute,THREE.Vector3,THREE.Vector3][]=[];
  for(const [u,x] of [[.08,d.start+(d.end-d.start)/4],[.94,d.end-.15]]){
    const local=boatHullPoint(u,-1),anchor=new THREE.Vector3(x,d.deck+.27,d.z+d.width*.5+.035);
    const geometry=new THREE.TubeGeometry(new THREE.LineCurve3(anchor,anchor.clone().add(new THREE.Vector3(1,0,0))),32,.011,6,false);
    p.mesh(group,geometry,cork,0,0,0).frustumCulled=false;
    ropes.push([geometry.attributes.position as THREE.BufferAttribute,anchor,local]);
  }
  function update(time:number){
    const y=oceanHeight(cx,cz,time);
    hull.position.set(cx,y,cz);
    hull.rotation.z=Math.atan2(oceanHeight(cx+1,cz,time)-oceanHeight(cx-1,cz,time),2);
    hull.rotation.x=Math.atan2(oceanHeight(cx,cz-.4,time)-oceanHeight(cx,cz+.4,time),.8);
    hull.updateMatrixWorld(true);
    inverse.copy(hull.matrixWorld).invert();
    for(const [positions,anchor,local] of ropes){
      const end=local.clone().applyMatrix4(hull.matrixWorld),along=end.clone().sub(anchor).normalize();
      const side=new THREE.Vector3().crossVectors(along,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(side,along).normalize();
      for(let i=0;i<=32;i++){const t=i/32,center=anchor.clone().lerp(end,t);center.y-=Math.sin(Math.PI*t)*.10;
        for(let j=0;j<=6;j++){const a=j/6*Math.PI*2,v=center.clone().addScaledVector(side,Math.cos(a)*.011).addScaledVector(up,Math.sin(a)*.011);positions.setXYZ(i*7+j,v.x,v.y,v.z);}}
      positions.needsUpdate=true;
    }
  }
  update(0);return {group,update,inverse};
}
