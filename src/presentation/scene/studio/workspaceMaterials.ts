import * as THREE from 'three';
type WorkspaceMaterials={timber:THREE.MeshStandardMaterial;end:THREE.MeshStandardMaterial;canvas:THREE.MeshStandardMaterial;cork:THREE.MeshStandardMaterial};
const sceneCache=new WeakMap<Set<THREE.Material>,WorkspaceMaterials>();

/** Scene-owned, deterministic surface detail; no per-frame texture generation. */
export function createWorkspaceMaterials(materials: Set<THREE.Material>, textures: Set<THREE.Texture>) {
  const cached=sceneCache.get(materials);if(cached)return cached;
  function surface(kind: 'wood'|'end'|'cloth'|'cork', color: number, roughness: number) {
    const size=256, data=new Uint8Array(size*size*4),relief=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const n=Math.sin(x*127.1+y*311.7)*43758.5453, noise=n-Math.floor(n);
      const vein=y+3*Math.sin(x*.019)+1.2*Math.sin(x*.061)+7*Math.exp(-((x-163)**2/3600+(y-88)**2/160));
      const grain=kind==='wood'?Math.sin(vein*.37+Math.sin(vein*.067)*2)*.45+Math.sin(vein*.93)*.18+Math.sin(vein*2.7)*.1
        :kind==='end'?Math.sin(Math.hypot(x-70,y-110)*.5)
        :kind==='cloth'?Math.sin(x*Math.PI/2+Math.sin(y*.073)*.4)*Math.cos(y*Math.PI/2+Math.sin(x*.061)*.3):noise*2-1;
      const v=Math.round((kind==='cloth'?245:235)+grain*(kind==='cloth'?3:17)+(noise-.5)*(kind==='cloth'?3:5)),i=(y*size+x)*4;
      data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
      relief[i]=relief[i+1]=relief[i+2]=Math.round(128+grain*20+(noise-.5)*12);relief[i+3]=255;
    }
    const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=4;map.needsUpdate=true;textures.add(map);
    const bump=new THREE.DataTexture(relief,size,size);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
    bump.generateMipmaps=true;bump.minFilter=THREE.LinearMipmapLinearFilter;bump.magFilter=THREE.LinearFilter;bump.needsUpdate=true;textures.add(bump);
    const mat=new THREE.MeshStandardMaterial({color,map,bumpMap:bump,bumpScale:kind==='cloth'?.00015:.001,roughness});
    mat.userData.workspaceGrain=kind==='wood';
    materials.add(mat);return mat;
  }
  const timber=surface('wood',0x896446,.83),end=surface('end',0x805d42,.9);
  const canvas=surface('cloth',0xe8dfc6,.98);canvas.side=THREE.DoubleSide;
  const result={timber,end,canvas,cork:surface('cork',0xa18459,.96)};
  sceneCache.set(materials,result);return result;
}
