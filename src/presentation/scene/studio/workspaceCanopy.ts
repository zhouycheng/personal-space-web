import * as THREE from 'three';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { canopyOpacity } from '../../../animation/studio/canopyVisibility.ts';
import type { StudioPrimitives } from './studioPrimitives';
import { createWorkspaceMaterials } from './workspaceMaterials';
import { canopySurface } from '../../../animation/studio/canopySurface.ts';

export function createWorkspaceCanopy(scene:THREE.Scene,p:StudioPrimitives,materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const group=new THREE.Group();group.name='workspace-canopy';scene.add(group);
  const {timber,canvas:cloth}=createWorkspaceMaterials(materials,textures);
  const canvas=cloth.clone();materials.add(canvas);
  canvas.map=null;canvas.bumpMap=null;canvas.color.setHex(0xe8dcc3);canvas.roughness=.94;canvas.shadowSide=THREE.BackSide;
  canvas.emissive.setHex(0xc2b697);canvas.emissiveIntensity=.065;canvas.alphaHash=true;
  const rope=p.material(0xb0a080,.97);
  function point(u:number,v:number,time=0) {
    const q=canopySurface(u,v,time);return new THREE.Vector3(q.x,q.y,q.z);
  }
  function line(points:THREE.Vector3[],radius:number,material:THREE.Material) {
    return p.mesh(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,radius,8,false),material,0,0,0);
  }
  for(const u of [0,1])for(const v of [0,1]) {
    const top=point(u,v),ground=terrainHeight(top.x,top.z);
    p.cylinder(group,.065,top.y-ground+.26,[top.x,(top.y+ground)/2,top.z],timber,.05);
    const anchor=new THREE.Vector3(top.x+(u? .52:-.52),0,top.z+(v?.32:-.6));anchor.y=terrainHeight(anchor.x,anchor.z);
    line([top,new THREE.Vector3().lerpVectors(top,anchor,.5).add(new THREE.Vector3(0,-.09,0)),anchor],.012,rope);
    const peg=p.cylinder(group,.025,.23,[anchor.x,anchor.y+.015,anchor.z],timber);peg.rotation.z=u?-.25:.25;
    // Small irregular sand bank hides the pole's cut end, matching local terrain.
    const bank=p.mesh(group,new THREE.SphereGeometry(.17,16,8),p.material(0xc7b88d,.99),top.x,ground-.032,top.z);bank.scale.set(1,.3,.82);
  }
  const geo=new THREE.PlaneGeometry(1,1,64,48),pos=geo.attributes.position;
  const coordinates:number[]=[];
  for(let i=0;i<pos.count;i++) {
    const u=pos.getX(i)+.5,v=pos.getY(i)+.5,q=point(u,v);
    coordinates.push(u,v);pos.setXYZ(i,q.x,q.y,q.z);
  }
  geo.computeVertexNormals();const roof=p.mesh(group,geo,canvas,0,0,0);roof.name='workspace-canopy-cloth';
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.BackSide,alphaHash:true});materials.add(depth);roof.customDepthMaterial=depth;
  const seams:THREE.Mesh[]=[];
  const hem=canvas.clone();hem.color.setHex(0xd3c2a2);materials.add(hem);
  const surfaces=[{geometry:geo,uv:coordinates,offset:0}];
  for(const [axis,fixed] of [[0,0],[0,.5],[0,1],[1,0],[1,1]]) {
    const geometry=new THREE.PlaneGeometry(1,1,64,1),a=geometry.attributes.position,uv:number[]=[];
    for(let i=0;i<a.count;i++) {
      const t=a.getX(i)+.5,across=a.getY(i)*.005,u=axis===0?Math.max(0,Math.min(1,fixed+across)):t,v=axis===1?Math.max(0,Math.min(1,fixed+across)):t;
      uv.push(u,v);const q=point(u,v);a.setXYZ(i,q.x,q.y+.004,q.z);
    }
    geometry.computeVertexNormals();const seam=p.mesh(group,geometry,hem,0,0,0);seam.castShadow=false;seam.receiveShadow=false;seams.push(seam);surfaces.push({geometry,uv,offset:.004});
  }
  let previous:number|undefined,opacity=1,lastWind=-1,lastShadow=-1;
  return {group,pause(){previous=undefined;},update(now:number,camera:THREE.Vector3,target:THREE.Vector3,reduced:boolean,windTime=0,windActive=false) {
    const from=camera.toArray();
    const wanted=Math.min(canopyOpacity(from,target.toArray()),canopyOpacity(from,[-.2,1.8,-1.4]),canopyOpacity(from,[1.04,1.474,-1.1]));
    const elapsed=previous===undefined?16:Math.min(50,now-previous);previous=now;
    const next=reduced?wanted:THREE.MathUtils.lerp(opacity,wanted,1-Math.exp(-elapsed/85));
    const settled=Math.abs(next-wanted)<.005?wanted:next,changed=settled!==opacity;opacity=settled;
    canvas.opacity=depth.opacity=opacity;roof.visible=opacity>0;for(const seam of seams)seam.visible=opacity>0;
    hem.opacity=opacity;
    const windChanged=windActive&&opacity>0&&windTime-lastWind>=1/30;
    if(windChanged) {
      for(const surface of surfaces) {
        const a=surface.geometry.attributes.position;
        for(let i=0;i<a.count;i++){const q=canopySurface(surface.uv[i*2],surface.uv[i*2+1],windTime);a.setXYZ(i,q.x,q.y+surface.offset,q.z);}
        a.needsUpdate=true;surface.geometry.computeVertexNormals();
      }
      lastWind=windTime;
    }
    const shadowChanged=changed||(windChanged&&windTime-lastShadow>=.1);if(shadowChanged)lastShadow=windTime;
    return {changed:changed||windChanged,shadowChanged,moving:opacity!==wanted||(windActive&&opacity>0)};
  }};
}
