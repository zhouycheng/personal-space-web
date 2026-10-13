import * as THREE from 'three';
import { BatchedRenderer, ParticleSystem, SpriteParticle, ConstantValue, RenderMode } from 'three.quarks';
import type { StudioPrimitives } from './studioPrimitives.ts';

/** Five persistent flame layers share one atlas and one Quarks draw. */
export function createCampfireFlame(p:StudioPrimitives,parent:THREE.Object3D,materials:Set<THREE.Material>,textures:Set<THREE.Texture>,geometries:Set<THREE.BufferGeometry>) {
  const placeholder=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);placeholder.needsUpdate=true;textures.add(placeholder);
  const material=new THREE.MeshBasicMaterial({map:placeholder,transparent:true,depthWrite:false,side:THREE.DoubleSide});materials.add(material);
  const plane=new THREE.PlaneGeometry(1,1);geometries.add(plane);
  const renderer=new BatchedRenderer();renderer.name='campfire-flame-batch';renderer.visible=false;
  const system=new ParticleSystem({material,instancingGeometry:plane,renderMode:RenderMode.VerticalBillBoard,
    uTileCount:16,vTileCount:8,blendTiles:true,worldSpace:false,emissionOverTime:new ConstantValue(0)});
  system.pause();system.particles=Array.from({length:5},()=>{const particle=new SpriteParticle();particle.life=Infinity;return particle;});system.particleNum=5;
  parent.add(system.emitter);renderer.addSystem(system);
  for(const batch of renderer.batches) {
    geometries.add(batch.geometry);
    for(const mat of Array.isArray(batch.material)?batch.material:[batch.material])materials.add(mat);
    const shader=batch.material as THREE.ShaderMaterial;
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','#include <tonemapping_fragment>\n#include <colorspace_fragment>');
    batch.frustumCulled=false;batch.castShadow=batch.receiveShadow=false;
  }
  const fallbackMaterial=new THREE.MeshBasicMaterial({color:0xff982b,transparent:true,opacity:.75});materials.add(fallbackMaterial);
  const fallback=p.mesh(parent,new THREE.ConeGeometry(.035,.13,7),fallbackMaterial,0,.16,0);fallback.name='campfire-static-ember-flame';fallback.castShadow=fallback.receiveShadow=false;
  let disposed=false,loaded=false,started=false,heat=0,time=0;
  function update() {
    const height=.22+Math.pow(heat,1.35)*1.85,width=.16+Math.pow(heat,1.15)*.86;
    system.particles.forEach((particle,i)=>{
      const side=i===0?0:i%2===0?1:-1,depth=[0,-.16,.1,.17,-.08][i];
      const size=i===0?1:[.82,.90,.64,.70][i-1];
      particle.position.set(side*(.04+heat*.30),.10+height*size*.48,depth*(.25+heat));
      particle.size.set(width*size,height*size,1);particle.rotation=side*.08;
      particle.color.set(1.04,.84+heat*.14,.66+heat*.22,i===0?.78+heat*.18:.8*Math.pow(heat,1.1));
      particle.uvTile=(i>=3?64:0)+(time*23+i*13.7)%62;
    });
    renderer.update(0);
    fallback.scale.setScalar(.65+heat*.35);
  }
  const clamp=(n:number)=>Math.max(0,Math.min(1,n));
  return {renderer,
    load(onChange:()=>void) {
      if(started)return;started=true;
      const texture=new THREE.TextureLoader().load(new URL('../../../content/scene/campfire/flame-atlas.png',import.meta.url).href,
        value=>{
          if(disposed){value.dispose();return;}
          loaded=true;renderer.visible=true;fallback.visible=false;
          for(const batch of renderer.batches)(batch.material as THREE.ShaderMaterial).uniforms.map.value=value;
          onChange();
        },undefined,()=>{if(!disposed){renderer.visible=false;fallback.visible=true;onChange();}});
      texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;textures.add(texture);
    },
    setHeat(value:number){heat=clamp(value);update();},
    tick(seconds:number){time+=seconds;update();return loaded;},
    dispose(){disposed=true;const batches=[...renderer.batches];system.dispose();for(const batch of batches){geometries.delete(batch.geometry);for(const mat of Array.isArray(batch.material)?batch.material:[batch.material])materials.delete(mat);batch.dispose();}renderer.removeFromParent();},
  };
}
