import * as THREE from 'three';
import type { StudioPrimitives } from './studioPrimitives.ts';

/** Matte yarn, world-scale loop detail and short curled fibres, shared by both rugs. */
export function createWoolMaterial(materials:Set<THREE.Material>,color:number) {
  const material=new THREE.MeshPhysicalMaterial({color,roughness:1,sheen:1,sheenColor:0xd8c7ac,sheenRoughness:1,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vWool;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWool=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 vWool;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 yarn=vWool.xz*730.;
      float loop=sin(yarn.x+sin(yarn.y)*.7)*sin(yarn.y);
      float filterWidth=max(fwidth(yarn.x),fwidth(yarn.y));
      float detail=1.-smoothstep(1.,4.,filterWidth);
      diffuseColor.rgb*=.92+.08*loop*detail+.035*sin(vWool.x*53.+sin(vWool.z*71.));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 pileUp=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));
      if(dot(normal,pileUp)<0.)normal=-normal;
      normal=normalize(normal+detail*.04*(cos(yarn.x)*normalize(dFdx(vWool))+cos(yarn.y)*normalize(dFdy(vWool))));`);
  };
  material.customProgramCacheKey=()=> 'wool-loop-pile-v1';materials.add(material);return material;
}

export function addWoolPile(p:StudioPrimitives,parent:THREE.Object3D,material:THREE.Material,width:number,depth:number,surface:(u:number,v:number)=>THREE.Vector3) {
  const vertices:number[]=[],uvs:number[]=[];
  const random=(i:number)=>{const n=Math.sin(i*127.1+17.7)*43758.5453;return n-Math.floor(n);};
  const count=Math.round(width*depth*4200);
  for(let i=0;i<count;i++) {
    const u=(random(i*7)-.5)*(width-.015),v=(random(i*7+1)-.5)*(depth-.015);
    const base=surface(u,v),angle=random(i*7+2)*Math.PI*2,h=.0015+random(i*7+3)*.003;
    const dx=Math.cos(angle),dz=Math.sin(angle),r=.00025+random(i*7+4)*.00035;
    const points=[base.clone().add(new THREE.Vector3(-dz*r,0,dx*r)),base.clone().add(new THREE.Vector3(dz*r,0,-dx*r)),base.clone().add(new THREE.Vector3(dx*h*.38+dz*r,h,-dx*r+dz*h*.38)),base.clone().add(new THREE.Vector3(dx*h*.38-dz*r,h,dx*r+dz*h*.38))];
    for(const j of [0,1,2,0,2,3]){vertices.push(...points[j].toArray());uvs.push(j%2,j>1?1:0);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  // The collective pile scatters light upward; individual ribbon normals produce dark aliasing.
  const normals=geometry.attributes.normal;for(let i=0;i<normals.count;i++)normals.setXYZ(i,0,1,0);
  const pile=p.mesh(parent,geometry,material,0,0,0);pile.name='short-wool-pile';pile.castShadow=false;
}
