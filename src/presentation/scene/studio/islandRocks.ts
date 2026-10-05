import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { islandRocks,rockBase } from '../../../config/islandTerrain.ts';
import { islandAppearance } from '../../../config/islandAppearance.ts';

/** Baked world-space vertices let all rocks share one material and draw call. */
export function createRockGeometry() {
  const pieces=islandRocks.map(rock=>{
    const geometry=new THREE.IcosahedronGeometry(1,rock.height>.5?9:4);
    const positions=geometry.attributes.position;
    const colors=[];
    const cos=Math.cos(rock.rotation),sin=Math.sin(rock.rotation),base=rockBase(rock);
    for(let i=0;i<positions.count;i++) {
      const px=positions.getX(i),py=positions.getY(i),pz=positions.getZ(i);
      const weather=1+.12*Math.sin(px*3.1+py*2.3+rock.seed)
        +.075*Math.sin(pz*4.3-py*2.7+rock.seed*.7)
        +.016*Math.sin(px*19+pz*13+rock.seed)*Math.sin(py*17-pz*11);
      // Broad worn faces, an asymmetric crown and a buried foot, never a scaled ball.
      const reef=rock.seed>=701;
      const power=(v:number)=>Math.sign(v)*Math.pow(Math.abs(v),reef?.70:.84);
      const x=power(px)*rock.width*weather,z=power(pz)*rock.depth*weather;
      const crown=reef?Math.min(power(py)*.5+.5,.86+.12*px-.09*pz):power(py)*.5+.5;
      const y=base+crown*rock.height*(.94+.08*px-.06*pz);
      positions.setXYZ(i,rock.x+x*cos-z*sin,y,rock.z+x*sin+z*cos);
      const tone=.88+.12*Math.sin(rock.seed*2.7)+.06*py;
      const color=new THREE.Color(0x827d70).multiplyScalar(tone);
      colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');
    const welded=mergeVertices(geometry);
    welded.computeVertexNormals();
    geometry.dispose();
    return welded;
  });
  const geometry=mergeGeometries(pieces)!;
  pieces.forEach(piece=>piece.dispose());
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

export function createRockMaterial() {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,
    emissive:0x203a54,emissiveIntensity:0});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec3 vRockPosition;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvRockPosition=position;');
    shader.fragmentShader=`varying vec3 vRockPosition;
      float rockHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float rockNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),
          mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),
          mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',`#include <color_fragment>
      vec3 rp=vRockPosition;
      float strata=rockNoise(rp*vec3(3.0,8.0,3.0));
      float fleck=rockNoise(rp*32.0);
      float wetRock=1.0-smoothstep(${islandAppearance.seaLevel-.04},${islandAppearance.seaLevel+.35},rp.y+strata*.02);
      diffuseColor.rgb*=(.72+.32*strata+.12*fleck)*mix(1.0,.57,wetRock);`).replace(
      '#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.94,.46,wetRock);').replace(
      '#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float relief=rockNoise(rp*18.0)*.012+rockNoise(rp*57.0)*.002;
      vec3 dx=dFdx(vViewPosition),dy=dFdy(vViewPosition);
      vec3 r1=cross(dy,normal),r2=cross(normal,dx);
      float det=dot(dx,r1);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));`);
  };
  return material;
}

// The same centers, orientation and extents drive the seabed silhouette and foam.
export function rockWaterFootprints(surfaceOnly:boolean) {
  const limit=surfaceOnly?.65:.25;
  return islandRocks.filter(r=>rockBase(r)<islandAppearance.seaLevel&&(!surfaceOnly||rockBase(r)+r.height>islandAppearance.seaLevel-.06)).map(r=>{
    const base=rockBase(r),relative=Math.max(-1,Math.min(1,2*(islandAppearance.seaLevel-base)/r.height-1));
    const slice=!surfaceOnly?1:Math.sqrt(Math.max(.12,1-relative*relative));
    const width=r.width*slice,depth=r.depth*slice,minimum=Math.min(width,depth),c=Math.cos(r.rotation),s=Math.sin(r.rotation);
    // Enclose the entire nonzero influence, including rounding in generated GLSL.
    const factor=1+limit/minimum;
    return {x:r.x,z:r.z,width,depth,minimum,c,s,limit,
      extentX:Math.hypot(c*width,s*depth)*factor+.001,extentZ:Math.hypot(s*width,c*depth)*factor+.001};
  });
}
const distanceField=(name:string,surfaceOnly:boolean)=>{
  const rocks=rockWaterFootprints(surfaceOnly),limit=surfaceOnly?.65:.25;
  const low=[Math.min(...rocks.map(r=>r.x-r.extentX)),Math.min(...rocks.map(r=>r.z-r.extentZ))];
  const high=[Math.max(...rocks.map(r=>r.x+r.extentX)),Math.max(...rocks.map(r=>r.z+r.extentZ))];
  return `float ${name}(vec2 p) {
    if(any(lessThan(p,vec2(${low.join(',')})))||any(greaterThan(p,vec2(${high.join(',')}))))return ${limit};
    float distanceToRock=${limit};
    ${rocks.map(r=>`{vec2 d=p-vec2(${r.x.toFixed(5)},${r.z.toFixed(5)});
      if(abs(d.x)<${r.extentX.toFixed(5)}&&abs(d.y)<${r.extentZ.toFixed(5)}){
        d=mat2(${r.c.toFixed(5)},${(-r.s).toFixed(5)},${r.s.toFixed(5)},${r.c.toFixed(5)})*d;
        distanceToRock=min(distanceToRock,(length(d/vec2(${r.width.toFixed(5)},${r.depth.toFixed(5)}))-1.0)*${r.minimum.toFixed(5)});
      }}`).join('\n')}
    return distanceToRock;
  }`;
};
export const rockCoastGLSL=distanceField('rockDistance',true)+distanceField('reefDistance',false);
