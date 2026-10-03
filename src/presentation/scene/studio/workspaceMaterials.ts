import * as THREE from 'three';
type WorkspaceMaterials={timber:THREE.MeshStandardMaterial;end:THREE.MeshStandardMaterial;canvas:THREE.MeshStandardMaterial;cork:THREE.MeshStandardMaterial};
const sceneCache=new WeakMap<Set<THREE.Material>,WorkspaceMaterials>();

/** Scene-owned, deterministic surface detail; no per-frame texture generation. */
export function createWorkspaceMaterials(materials: Set<THREE.Material>, textures: Set<THREE.Texture>) {
  const cached=sceneCache.get(materials);if(cached)return cached;
  function surface(kind: 'wood'|'end'|'cloth'|'cork', color: number, roughness: number) {
    const size=256, data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const n=Math.sin(x*127.1+y*311.7)*43758.5453, noise=n-Math.floor(n);
      const grain=kind==='wood'?Math.sin(y*.46+Math.sin(x*.025)*2+Math.sin(y*.06)*3)
        :kind==='end'?Math.sin(Math.hypot(x-70,y-110)*.5)
        :kind==='cloth'?((x%4===0||y%4===0)?-1:.4):noise*2-1;
      const v=Math.round(225+grain*(kind==='cloth'?10:6)+(noise-.5)*9),i=(y*size+x)*4;
      data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
    }
    const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;textures.add(map);
    const mat=new THREE.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:kind==='cloth'?.003:.002,roughness});
    mat.userData.workspaceGrain=kind==='wood';
    materials.add(mat);return mat;
  }
  const timber=surface('wood',0xa47a50,.83),end=surface('end',0x99714b,.9);
  const canvas=surface('cloth',0xe8dfc6,.98);canvas.side=THREE.DoubleSide;
  const result={timber,end,canvas,cork:surface('cork',0xa18459,.96)};
  sceneCache.set(materials,result);return result;
}
