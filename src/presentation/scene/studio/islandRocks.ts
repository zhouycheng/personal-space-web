import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { islandRocks,rockBase,coastRadius,smoothstep } from '../../../config/islandTerrain.ts';
import { islandAppearance } from '../../../config/islandAppearance.ts';
import { marineReefs } from '../../../config/marineLife.ts';
import { oceanWaves,shoreWaves } from '../../../config/oceanWaves.ts';
import { rockSectionSamples,ROCK_SECTION_ANGLES,ROCK_SECTION_LEVELS,ROCK_SECTION_BOTTOM,ROCK_SECTION_TOP } from './rockContact.ts';

/** Baked world-space vertices let all rocks share one material and draw call. */
export function createRockGeometry(rocks: readonly (typeof islandRocks[number] & {base?:number})[] = islandRocks, detail?:number) {
  const pieces=rocks.map(rock=>{
    const geometry=new THREE.IcosahedronGeometry(1,detail??(rock.height>.5?9:4));
    const positions=geometry.attributes.position;
    const colors=[];
    const cos=Math.cos(rock.rotation),sin=Math.sin(rock.rotation),base=rock.base??rockBase(rock);
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
export function rockContacts() {
  return [...islandRocks,...marineReefs].flatMap(rock=>{
    const base='base' in rock&&typeof rock.base==='number'?rock.base:rockBase(rock), r=coastRadius(rock.x,rock.z);
    const reach=oceanWaves.reduce((sum,w)=>sum+w[1],0)*smoothstep(1.05,1.65,r)
      +shoreWaves.reduce((sum,w)=>sum+w[0],0)*(1-smoothstep(1.03,1.45,r));
    if(base>=islandAppearance.seaLevel+reach||base+rock.height*1.08<=islandAppearance.seaLevel-reach||r>2.1)return [];
    const c=Math.cos(rock.rotation),s=Math.sin(rock.rotation);
    return [{...rock,base,c,s,extentX:(Math.abs(c)*rock.width+Math.abs(s)*rock.depth)*1.22+.3,
      extentZ:(Math.abs(s)*rock.width+Math.abs(c)*rock.depth)*1.22+.3}];
  });
}
const contacts=rockContacts();
export const ROCK_CONTACT_BYTES=(ROCK_SECTION_ANGLES+1)*ROCK_SECTION_LEVELS*contacts.length*8;
export function createRockContactData() {
  const width=ROCK_SECTION_ANGLES+1,height=ROCK_SECTION_LEVELS*contacts.length;
  const data=new Uint16Array(width*height*4);
  contacts.forEach((rock,i)=>{
    const geometry=createRockGeometry([rock],rock.seed>=901?2:undefined);
    const samples=rockSectionSamples(geometry,rock);geometry.dispose();
    for(let j=0;j<samples.length;j++)data[i*samples.length+j]=THREE.DataUtils.toHalfFloat(samples[j]);
  });
  return data;
}
export function createRockContactTexture(data:Uint16Array=createRockContactData()) {
  const texture=new THREE.DataTexture(data,ROCK_SECTION_ANGLES+1,ROCK_SECTION_LEVELS*contacts.length,THREE.RGBAFormat,THREE.HalfFloatType);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}
const contactField=`uniform sampler2D rockSections;
  float rockDistance(vec2 p,float waterY) {
    if(waterY<=${ROCK_SECTION_BOTTOM}||waterY>=${ROCK_SECTION_TOP})return .24;
    if(any(lessThan(p,vec2(${Math.min(...contacts.map(r=>r.x-r.extentX))},${Math.min(...contacts.map(r=>r.z-r.extentZ))})))||
       any(greaterThan(p,vec2(${Math.max(...contacts.map(r=>r.x+r.extentX))},${Math.max(...contacts.map(r=>r.z+r.extentZ))}))))return .24;
    float d=.24;
    float level=clamp((waterY-(${ROCK_SECTION_BOTTOM}))/${ROCK_SECTION_TOP-ROCK_SECTION_BOTTOM},0.,1.)*${(ROCK_SECTION_LEVELS-1).toFixed(1)};
    ${contacts.map((r,i)=>`{
      vec2 q=p-vec2(${r.x.toFixed(6)},${r.z.toFixed(6)});
      if(abs(q.x)<${r.extentX.toFixed(6)}&&abs(q.y)<${r.extentZ.toFixed(6)}&&waterY>${r.base.toFixed(6)}&&waterY<${(r.base+r.height*1.08).toFixed(6)}) {
        q=mat2(${r.c.toFixed(8)},${(-r.s).toFixed(8)},${r.s.toFixed(8)},${r.c.toFixed(8)})*q;
        float row=(${(i*ROCK_SECTION_LEVELS+.5).toFixed(1)}+level)/${(ROCK_SECTION_LEVELS*contacts.length).toFixed(1)};
        vec4 section=textureLod(rockSections,vec2(${.5/(ROCK_SECTION_ANGLES+1)},row),0.);
        if(section.a>0.) {
          q-=section.xy;
          float angle=atan(q.y,q.x)/6.28318530718;
          if(angle<0.)angle+=1.;
          float radius=textureLod(rockSections,vec2((angle*${ROCK_SECTION_ANGLES.toFixed(1)}+.5)/${(ROCK_SECTION_ANGLES+1).toFixed(1)},row),0.).b;
          d=min(d,mix(.24,length(q)-radius,smoothstep(0.,.025,section.a)));
        }
      }
    }`).join('\n')}
    return d;
  }
`;
export const rockCoastGLSL=contactField+distanceField('reefDistance',false);
