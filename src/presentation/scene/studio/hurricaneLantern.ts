import * as THREE from 'three';
import type { StudioPrimitives } from './studioPrimitives.ts';
type Skin={metal:THREE.Material;brass:THREE.Material;glass:THREE.Material;wick:THREE.Material;core:THREE.Material;dark:THREE.Material};
const templates=new WeakMap<THREE.Material,THREE.Group>();

/** A shared hurricane-lamp assembly, with actual glass thickness and supported hardware. */
export function createHurricaneLantern(p:StudioPrimitives,skin:Skin) {
  const cached=templates.get(skin.glass);if(cached)return cached.clone(true);
  const g=new THREE.Group();g.name='hurricane-lantern';
  const lathe=(profile:number[][],mat:THREE.Material)=>{
    const curve=new THREE.CatmullRomCurve3(profile.map(([r,h])=>new THREE.Vector3(r,h,0)));
    return p.mesh(g,new THREE.LatheGeometry(curve.getPoints(64).map(v=>new THREE.Vector2(Math.max(0,v.x),Math.max(0,v.y))),48),mat,0,0,0);
  };
  const ring=(r:number,y:number,t:number,mat:THREE.Material)=>{const m=p.mesh(g,new THREE.TorusGeometry(r,t,8,48),mat,0,y,0);m.rotation.x=Math.PI/2;};
  const tube=(points:number[][],radius:number,mat:THREE.Material)=>p.mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(v[0],v[1],v[2]))),32,radius,8,false),mat,0,0,0);
  lathe([[0,0],[.145,0],[.166,.018],[.169,.037],[.161,.084],[.13,.113],[.075,.135],[0,.135]],skin.metal);
  ring(.164,.03,.005,skin.brass);ring(.097,.154,.005,skin.metal);
  lathe([[.055,.135],[.063,.15],[.065,.17],[.036,.185],[.025,.195]],skin.brass);
  p.box(g,[.022,.018,.009],[0,.196,0],skin.dark);
  const fire=new THREE.SphereGeometry(1,24,20),verts=fire.attributes.position;
  for(let i=0;i<verts.count;i++){const y=verts.getY(i),t=(y+1)/2;verts.setXYZ(i,verts.getX(i)*(1-.7*t)+.23*t*t,y,verts.getZ(i)*(1-.7*t));}fire.computeVertexNormals();
  const flame=p.mesh(g,fire,skin.wick,0,.239,0);flame.scale.set(.026,.05,.023);flame.castShadow=false;
  const core=p.mesh(g,fire,skin.core,0,.226,.003);core.scale.set(.014,.033,.014);core.castShadow=false;
  // Closed thin wall: both lips join the inner and outer profiles.
  const chimney=lathe([[.073,.177],[.085,.186],[.106,.223],[.109,.28],[.098,.336],[.073,.383],[.063,.421],
    [.060,.421],[.070,.383],[.095,.336],[.106,.28],[.103,.223],[.082,.186],[.070,.177],[.073,.177]],skin.glass);
  chimney.castShadow=false;chimney.receiveShadow=false;
  lathe([[.064,.422],[.123,.43],[.128,.444],[.11,.463],[.068,.49],[.061,.523],[.044,.542],[0,.545]],skin.metal);
  ring(.12,.441,.004,skin.brass);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,vent=p.rounded(g,[.012,.023,.004],[Math.sin(a)*.064,.505,Math.cos(a)*.064],skin.dark,.002);vent.rotation.y=a;}
  for(const side of [-1,1]){
    tube([[side*.13,.075,0],[side*.163,.135,0],[side*.168,.325,0],[side*.13,.424,0],[side*.065,.488,0]],.014,skin.metal);
    const pivot=p.cylinder(g,.02,.019,[side*.158,.365,0],skin.brass);pivot.rotation.x=Math.PI/2;
  }
  tube([[-.158,.365,.01],[-.175,.56,.035],[-.1,.665,.045],[.08,.668,.045],[.174,.55,.035],[.158,.365,.01]],.0055,skin.brass);
  const knob=p.cylinder(g,.023,.015,[.096,.162,.015],skin.brass);knob.rotation.z=Math.PI/2;
  for(let i=0;i<16;i++){const a=i*Math.PI/8;const tooth=p.mesh(knob,new THREE.SphereGeometry(.003,6,4),skin.dark,Math.cos(a)*.023,0,Math.sin(a)*.023);tooth.scale.y=1.8;}
  p.cylinder(g,.028,.013,[.105,.104,.057],skin.brass);
  templates.set(skin.glass,g);return g.clone(true);
}
