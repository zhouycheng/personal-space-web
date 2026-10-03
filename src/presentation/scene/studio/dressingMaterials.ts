import * as THREE from 'three';

/** Small, scene-owned material maps. Colour and surface relief use separate colour spaces. */
export function createDressingMaterials(materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  function surface(kind:'wood'|'leather'|'metal'|'ceramic'|'paper',color:number,roughness:number) {
    const size=256,colour=new Uint8Array(size*size*4),relief=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const r=Math.sin(x*127.1+y*311.7)*43758.5453,n=r-Math.floor(r);
      const knot=Math.exp(-((x-156)**2/2100+(y-87)**2/170));
      const vein=y+2*Math.sin(x*.032)+.7*Math.sin(x*.13)+knot*11;
      const grain=Math.sin(vein*.67+Math.sin(y*.09)*2)*.6+Math.sin(vein*1.37+x*.008)*.25+Math.sin(vein*3.9)*.15;
      const pore=Math.pow(n,12);
      const figure=kind==='wood'?grain*.045+Math.sin(vein*.14)*.045-pore*.06
        :kind==='leather'?-.085*pore+.025*Math.sin(x*.4)*Math.sin(y*.47)
        :kind==='metal'?.018*Math.sin(x*.08+y*.045)-pore*.025
        :kind==='paper'?.025*Math.sin(x*2.7)-pore*.025
        :.02*Math.sin(y*.85)+.025*(n-.5);
      const v=Math.round(255*Math.min(1,.94+figure)),b=Math.round(128+figure*200),i=(y*size+x)*4;
      colour[i]=colour[i+1]=colour[i+2]=v;colour[i+3]=255;
      relief[i]=relief[i+1]=relief[i+2]=b;relief[i+3]=255;
    }
    function texture(data:Uint8Array,srgb:boolean) {
      const map=new THREE.DataTexture(data,size,size);if(srgb)map.colorSpace=THREE.SRGBColorSpace;
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;
      map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;textures.add(map);return map;
    }
    const bump=texture(relief,false);
    const mat=new THREE.MeshStandardMaterial({color,map:texture(colour,true),bumpMap:bump,bumpScale:kind==='wood'?.007:kind==='leather'?.003:.001,roughness,metalness:kind==='metal'?.48:0});
    mat.userData.workspaceGrain=kind==='wood';materials.add(mat);return mat;
  }
  const timber=surface('wood',0xb28b60,.76),leather=surface('leather',0x86634a,.73);
  const metal=surface('metal',0x6c7768,.34),ceramic=surface('ceramic',0xc4b195,.3),paper=surface('paper',0xe8ddc4,.96);
  const brass=new THREE.MeshStandardMaterial({color:0xb29b6b,roughness:.38,metalness:.65});materials.add(brass);
  // A small soft sky reflection gives curved metal/glass readable highlights without a capture pass.
  const pixels=new Uint8Array(128*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<128;x++) {
    const t=y/63,sky=Math.max(0,1-t*1.6),glow=Math.exp(-((x-34)**2/42+(y-18)**2/90));
    const i=(y*128+x)*4;
    pixels[i]=Math.min(255,55+sky*105+glow*95);pixels[i+1]=Math.min(255,52+sky*130+glow*70);pixels[i+2]=Math.min(255,45+sky*160+glow*40);pixels[i+3]=255;
  }
  const reflection=new THREE.DataTexture(pixels,128,64);reflection.colorSpace=THREE.SRGBColorSpace;
  reflection.mapping=THREE.EquirectangularReflectionMapping;reflection.needsUpdate=true;textures.add(reflection);
  for(const mat of [metal,brass,ceramic]){mat.envMap=reflection;mat.envMapIntensity=.65;}
  return {timber,leather,metal,ceramic,paper,brass,reflection};
}
