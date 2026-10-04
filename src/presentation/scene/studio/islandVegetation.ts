import * as THREE from 'three';
import { breezeGLSL } from '../../../animation/studio/breeze.ts';
import { leafDetailLevel } from './leafDetails.ts';
import { createVegetationGeometry,type VegetationGeometry } from './vegetationGeometry.ts';

export function createIslandVegetation(materials:Set<THREE.Material>,geometries:Set<THREE.BufferGeometry>,prepared?:VegetationGeometry) {
  const group=new THREE.Group();group.name='island-vegetation';
  const data=prepared??createVegetationGeometry();
  const bark=new THREE.MeshStandardMaterial({color:0x8d8066,roughness:.96});
  bark.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec3 vBark;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvBark=position;');
    shader.fragmentShader=`varying vec3 vBark;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
      float band=sin(vBark.y*83.0+sin(vBark.x*19.0+vBark.z*17.0)*.65);
      float fiber=sin(vBark.x*143.0+vBark.z*131.0+sin(vBark.y*7.0));
      diffuseColor.rgb*=.87+.11*band+.045*fiber;`);
  };
  const foliage=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.82});
  foliage.shadowSide=THREE.BackSide;
  const stemMaterial=new THREE.MeshStandardMaterial({color:0x65763a,roughness:.9});
  const time={value:0};
  const windHeader=`uniform float breezeTime;attribute vec3 windAnchor;${breezeGLSL}
  vec3 branchOffset(vec3 p) {
    vec3 b=p-windAnchor;float r=length(b),wind=breezeAt(windAnchor.xz,max(0.,breezeTime-r*.085));
    float flutter=sin(breezeTime*3.1-r*4.7+dot(windAnchor.xz,vec2(.73,.51)))*.0025*(1.-exp(-breezeTime*.7));
    return vec3(.85,.18,.53)*r*r*(.024*wind+flutter);
  }`;
  const displacement=`
    transformed+=branchOffset(position);
  `;
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});materials.add(depth);
  for(const mat of [foliage,stemMaterial,depth]) {
    mat.onBeforeCompile=shader=>{shader.uniforms.breezeTime=time;shader.vertexShader=windHeader+'\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n${displacement}`);
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec3 b=position-windAnchor;float r=length(b);
        float strength=.024*breezeAt(windAnchor.xz,max(0.,breezeTime-r*.085));
        vec3 gradient=2.*b*strength,dir=vec3(.85,.18,.53);
        objectNormal=normalize(objectNormal-gradient*dot(dir,objectNormal)/(1.+dot(dir,gradient)));`);
    };
        mat.customProgramCacheKey=()=> 'island-anchored-breeze-v3';
  }
  const foliageCompile=foliage.onBeforeCompile;
  foliage.onBeforeCompile=(shader,renderer)=>{
    foliageCompile.call(foliage,shader,renderer);
    shader.vertexShader='attribute vec2 leafUv;varying vec2 vLeafUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLeafUv=leafUv;');
    shader.fragmentShader='varying vec2 vLeafUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float centerVein=exp(-abs(vLeafUv.x-.5)*110.);
      float veins=pow(.5+.5*sin(vLeafUv.y*135.+abs(vLeafUv.x-.5)*35.),14.);
      float mottling=sin(vLeafUv.y*47.+sin(vLeafUv.x*31.))*sin(vLeafUv.x*73.+vLeafUv.y*19.);
      diffuseColor.rgb*=1.+.055*centerVein-.045*veins+.025*mottling;`);
  };
  const details=data.details.map(levels=>{
    const mesh=new THREE.Mesh(levels[0].geometry,foliage);
    mesh.name='plant-leaves';mesh.userData.detailLevel=0;mesh.castShadow=true;mesh.customDepthMaterial=depth;
    group.add(mesh);levels.forEach(level=>geometries.add(level.geometry));
    return {mesh,levels,errors:levels.map(level=>level.error),level:0};
  });
  materials.add(foliage);
  const {trunkGeometry,stemGeometry}=data;
  for(const [geometry,material] of [[trunkGeometry,bark],[stemGeometry,stemMaterial]] as const) {
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
    if(material!==bark){mesh.customDepthMaterial=depth;geometry.boundingSphere!.radius+=.35;}
    group.add(mesh);geometries.add(geometry);materials.add(material);
  }
  const center=new THREE.Vector3();
  return Object.assign(group,{setWind(seconds:number){time.value=seconds;},updateDetail(camera:THREE.PerspectiveCamera,height:number){
    camera.updateMatrixWorld();let changed=false;
    const scale=height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
    for(const item of details) {
      const sphere=item.levels[0].geometry.boundingSphere!;
      center.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
      const near=Math.max(camera.near,-center.z-sphere.radius);
      const projectionScale=scale/near*Math.sqrt(1+((Math.abs(center.x)+sphere.radius)**2+(Math.abs(center.y)+sphere.radius)**2)/(near*near));
      const level=leafDetailLevel(item.errors,projectionScale,item.level);
      if(level!==item.level){item.level=level;item.mesh.geometry=item.levels[level].geometry;item.mesh.userData.detailLevel=level;changed=true;}
    }
    return changed;
  }});
}
