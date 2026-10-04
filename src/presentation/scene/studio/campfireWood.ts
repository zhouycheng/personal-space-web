import * as THREE from 'three';

/** Longitudinal bark plates with broken charcoal cracks, rather than raised stripes. */
export function createCampfireWood(materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=Math.sin(x*127.1+y*311.7)*43758.5453,n=noise-Math.floor(noise);
    const grain=Math.sin(x*.31+Math.sin(y*.047)*.8+Math.sin(y*.12+x*.08)*.25);
    const crack=Math.pow(Math.max(0,grain),18);
    const cross=Math.pow(Math.max(0,Math.sin(y*.17+Math.sin(x*.07)*2)),28);
    const tone=30+n*15+grain*7-20*Math.max(crack,cross),i=(y*size+x)*4;
    data[i]=tone*1.15;data[i+1]=tone;data[i+2]=tone*.82;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.needsUpdate=true;textures.add(map);
  const bark=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.014,roughness:1});materials.add(bark);
  return bark;
}
