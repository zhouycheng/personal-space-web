import * as THREE from 'three';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { canopyDistanceOpacity,fadeCanopyOpacity } from '../../../animation/studio/canopyVisibility.ts';
import type { StudioPrimitives } from './studioPrimitives';
import { createWorkspaceMaterials } from './workspaceMaterials';
import { canopySurface,canopySurfaceGLSL } from '../../../animation/studio/canopySurface.ts';

export function createWorkspaceCanopy(scene:THREE.Scene,p:StudioPrimitives,materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const group=new THREE.Group();group.name='workspace-canopy';scene.add(group);
  const {timber,canvas:cloth}=createWorkspaceMaterials(materials,textures);
  const canvas=cloth.clone();materials.add(canvas);
  canvas.color.setHex(0xe8dcc3);canvas.bumpScale=.0001;canvas.roughness=.94;canvas.shadowSide=THREE.DoubleSide;
  canvas.emissive.setHex(0xc2b697);canvas.emissiveIntensity=.065;
  canvas.transparent=true;canvas.depthWrite=false;canvas.forceSinglePass=true;
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
  // Use the upper surface orientation for shadow receiver bias on this thin cloth.
  const index=geo.index!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
  geo.computeVertexNormals();const roof=p.mesh(group,geo,canvas,0,0,0);roof.name='workspace-canopy-cloth';
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide,alphaHash:true});materials.add(depth);roof.customDepthMaterial=depth;
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
  // Keep all deformed passes coherent without rebuilding vertex arrays or normals.
  const time={value:0};
  for(const surface of surfaces) {
    const g=surface.geometry;
    g.setAttribute('canopyUv',new THREE.Float32BufferAttribute(surface.uv,2));
    g.setAttribute('canopyLift',new THREE.Float32BufferAttribute(new Float32Array(surface.uv.length/2).fill(surface.offset),1));
    const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,surface.uv[i*2]*12,surface.uv[i*2+1]*9);
    g.computeBoundingSphere();g.boundingSphere!.radius+=.18;
  }
  for(const material of [canvas,hem,depth]) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.canopyTime=time;
      shader.vertexShader=`uniform float canopyTime;attribute vec2 canopyUv;attribute float canopyLift;\n${canopySurfaceGLSL}\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec2 lo=max(vec2(0.),canopyUv-vec2(.001)),hi=min(vec2(1.),canopyUv+vec2(.001));
        vec3 du=canopySurface(vec2(hi.x,canopyUv.y),canopyTime)-canopySurface(vec2(lo.x,canopyUv.y),canopyTime);
        vec3 dv=canopySurface(vec2(canopyUv.x,hi.y),canopyTime)-canopySurface(vec2(canopyUv.x,lo.y),canopyTime);
        objectNormal=normalize(cross(dv,du));`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=canopySurface(canopyUv,canopyTime)+vec3(0.,canopyLift,0.);`);
      // A thin, deforming two-sided sheet needs a receiver offset as well as
      // normal bias, otherwise its underside develops contour-like self shadows.
      shader.vertexShader=shader.vertexShader.replace('#include <shadowmap_vertex>',`#include <shadowmap_vertex>
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
          vDirectionalShadowCoord[0].z-=.00035*vDirectionalShadowCoord[0].w;
        #endif`);
    };
    material.customProgramCacheKey=()=> 'anchored-canopy-v3';
  }
  // Sewn reinforcement triangles share the same surface deformation.
  for(const u of [0,1])for(const v of [0,1]){
    const g=new THREE.BufferGeometry(),uv=[u,v,u+(u?-.055:.055),v,u,v+(v?-.075:.075)];
    const positions=[];for(let i=0;i<3;i++){const q=point(uv[i*2],uv[i*2+1]);positions.push(q.x,q.y+.007,q.z);}
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv.map(n=>n*10),2));
    g.setAttribute('canopyUv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('canopyLift',new THREE.Float32BufferAttribute([.007,.007,.007],1));g.computeVertexNormals();
    const patch=p.mesh(group,g,hem,0,0,0);patch.castShadow=false;seams.push(patch);
    const top=point(u,v),ring=p.mesh(group,new THREE.TorusGeometry(.032,.008,8,24),p.brass,top.x,top.y+.012,top.z);ring.rotation.x=-Math.PI/2;
  }
  let previous:number|undefined,opacity=1,lastWind=-1;
  return {group,pause(){previous=undefined;},update(now:number,camera:THREE.Vector3,_target:THREE.Vector3,reduced:boolean,windTime=0,windActive=false,clearWorkspace=false) {
    const from=camera.toArray();
    const wanted=clearWorkspace?0:canopyDistanceOpacity(from);
    const elapsed=previous===undefined?16:Math.min(50,now-previous);previous=now;
    const next=fadeCanopyOpacity(opacity,wanted,elapsed,reduced),changed=next!==opacity;opacity=next;
    canvas.opacity=depth.opacity=opacity;roof.visible=opacity>0;for(const seam of seams)seam.visible=opacity>0;
    hem.opacity=opacity;
    const windChanged=windActive&&opacity>0&&windTime!==lastWind;
    if(windChanged) {
      time.value=windTime;lastWind=windTime;
    }
    const shadowChanged=changed||windChanged;
    return {changed:changed||windChanged,shadowChanged,moving:opacity!==wanted||(windActive&&opacity>0)};
  }};
}
