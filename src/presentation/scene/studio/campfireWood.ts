import * as THREE from 'three';

const sceneCache=new WeakMap<Set<THREE.Material>,ReturnType<typeof buildCampfireWood>>();

/** Rack and fire logs share bark maps while retaining individual burn uniforms. */
export function createCampfireWood(materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const cached=sceneCache.get(materials);if(cached)return cached;
  const result=buildCampfireWood(materials,textures);sceneCache.set(materials,result);return result;
}

function buildCampfireWood(materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const fallback=new THREE.DataTexture(new Uint8Array([77,51,32,255]),1,1);fallback.needsUpdate=true;textures.add(fallback);
  const surfaces:THREE.MeshStandardMaterial[]=[];
  let disposed=false,started=false;
  function createSurface() {
    const burn={value:0},heat={value:0},pose={value:new THREE.Matrix4()};
    const material=new THREE.MeshStandardMaterial({map:fallback,bumpMap:fallback,bumpScale:.016,roughness:1});
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{woodBurn:burn,woodHeat:heat,woodPose:pose});
      shader.vertexShader='attribute float woodSurface; uniform mat4 woodPose; varying float vWoodSurface; varying vec3 vWoodPosition; varying vec3 vHearthPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWoodSurface=woodSurface;vWoodPosition=position;vHearthPosition=(woodPose*vec4(position,1.)).xyz;');
      shader.fragmentShader=`uniform float woodBurn; uniform float woodHeat; varying float vWoodSurface; varying vec3 vWoodPosition; varying vec3 vHearthPosition;
        vec2 woodHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
        float woodNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(woodHash(i).x,woodHash(i+vec2(1.,0.)).x,f.x),mix(woodHash(i+vec2(0.,1.)).x,woodHash(i+vec2(1.)).x,f.x),f.y);}
        vec2 coalCell(vec2 p){vec2 cell=floor(p),f=fract(p);float a=10.,b=10.;
          for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 n=vec2(float(x),float(y));float d=length(n+woodHash(cell+n)-f);if(d<a){b=a;a=d;}else b=min(b,d);}
          return vec2(b-a,a);
        }
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float grain=woodNoise(vec2(vWoodPosition.x*75.+sin(vWoodPosition.y*12.)*1.4,vWoodPosition.y*4.));
        vec2 plate=coalCell(vWoodPosition.xy*vec2(5.,16.)+vWoodPosition.z*2.);
        float fissure=1.-smoothstep(.006,.044,plate.x);
        float cut=step(.5,vWoodSurface);
        vec3 splitColor=vec3(.17,.087,.035)*(.62+grain*.68);
        float rings=sin(length((vWoodPosition.xz+vec2(.16,.48))*vec2(1.,1.12))*44.+grain*.25);
        splitColor*=1.-step(1.5,vWoodSurface)*(.16+.13*rings);
        diffuseColor.rgb=mix(diffuseColor.rgb*.68,splitColor,cut);
        float facing=1.-smoothstep(.14,.60,length(vHearthPosition.xz));
        float bottom=1.-smoothstep(-.55,.30,vWoodPosition.z);
        float exposure=clamp(facing*.85+bottom*.35,0.,1.);
        float seconds=woodBurn*180.;
        float onset=mix(26.,1.5,exposure)+plate.y*4.;
        float toasted=smoothstep(onset*.25,onset+9.,seconds);
        float charred=smoothstep(onset,onset+27.,seconds);
        vec3 coal=vec3(.009,.008,.007)*(1.+plate.y*.55)*(1.-fissure*.8);
        float ash=smoothstep(110.,180.,seconds)*(.35+.65*woodNoise(vWoodPosition.xy*vec2(4.,9.)));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.065,.027,.009),toasted*.8);
        diffuseColor.rgb=mix(diffuseColor.rgb,coal,charred);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.13,.115),ash*.8);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float ember=charred*fissure*max(0.,sin(woodBurn*3.14159265))*woodHeat*(.2+.8*exposure);
        totalEmissiveRadiance+=vec3(.055,.0045,.0003)*ember;
      `);
    };
    material.customProgramCacheKey=()=> 'campfire-split-wood-v2';materials.add(material);surfaces.push(material);
    return {material,burn,heat,pose};
  }
  return {createSurface,
    load(onChange:()=>void) {
      if(started)return;started=true;
      const urls=[new URL('../../../content/scene/campfire/bark-color.jpg',import.meta.url).href,new URL('../../../content/scene/campfire/bark-height.jpg',import.meta.url).href];
      urls.forEach((url,index)=>{
        const texture=new THREE.TextureLoader().load(url,value=>{
          if(disposed){value.dispose();return;}
          surfaces.forEach(material=>{if(index===0)material.map=value;else material.bumpMap=value;material.needsUpdate=true;});onChange();
        },undefined,()=>{if(!disposed)onChange();});
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=index===0?THREE.SRGBColorSpace:THREE.NoColorSpace;textures.add(texture);
      });
    },dispose(){disposed=true;},
  };
}

/** Rounded bark and ragged split faces share three reusable fractured shapes. */
export function createSplitLogGeometry(variant:number) {
  const section=Array.from({length:9},(_,i)=>{const a=Math.PI+i*Math.PI/8;return [Math.cos(a),.12+Math.sin(a)*.91];});
  section.push([.58,.50],[.02,.56],[-.48,.46]);
  const positions:number[]=[],charred:number[]=[],uv:number[]=[],surfaces:number[]=[];
  function vertex(v:number[],surface:number,part:number) {
    const [x,y,z]=v;positions.push(x,y,z);surfaces.push(surface);
    uv.push(surface===0?(Math.atan2(z-.12,x)+Math.PI)/(Math.PI*2):x*.5+.5,y*1.15+.5+variant*.19);
    const center=(part-1)/3,rough=.80+.12*Math.sin(x*13+y*41+variant*2);
    charred.push(x*rough+(part-1)*.045,center+(y-center)*.87,z*rough-Math.abs(part-1)*.04);
  }
  function triangle(a:number[],b:number[],c:number[],surface:number,part:number){for(const v of [a,b,c])vertex(v,surface,part);}
  function point(index:number,y:number) {
    const edge=index%section.length,[x,z]=section[edge],rough=.91+.065*Math.sin(edge*2+variant*3+y*17);
    const taper=1-.17*Math.abs(y*2)+.025*Math.sin(y*22+variant);
    return [x*rough*taper+Math.sin(y*6+variant)*.055,y+(Math.abs(y)>.49?.024*Math.sin(edge*3+variant):0),z*taper*(.95+.05*Math.sin(y*13+edge))];
  }
  for(let part=0;part<3;part++) {
    const low=-.5+part/3,high=low+1/3;
    for(let i=0;i<section.length;i++) {
      const surface=i>=8?1:0;
      for(let segment=0;segment<2;segment++) {
        const a=point(i,low+segment/6),b=point(i+1,low+segment/6),c=point(i+1,low+(segment+1)/6),d=point(i,low+(segment+1)/6);
        triangle(a,c,b,surface,part);triangle(a,d,c,surface,part);
      }
      triangle([0,low,0],point(i,low),point(i+1,low),2,part);
      triangle([0,high,0],point(i+1,high),point(i,high),2,part);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('woodSurface',new THREE.Float32BufferAttribute(surfaces,1));geometry.computeVertexNormals();
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<surfaces.length;i++)if(surfaces[i]===0){const n=new THREE.Vector3(positions[i*3],0,positions[i*3+2]-.12).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  else if(surfaces[i]===2)normals.setXYZ(i,0,Math.sign(normals.getY(i)),0);
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(charred,3)];geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
