import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { journalAppearance } from "../../../config/journalAppearance.ts";
import { disposeSafely } from "../../../infrastructure/client/dispose.ts";

const W = 1;
export const BOOK_HEIGHT = 594 / 420;
const H = BOOK_HEIGHT;

export function createJournalBookGeometry(scene: THREE.Scene) {
  const root = new THREE.Group();root.visible = false;scene.add(root);
  const orientation = new THREE.Group();root.add(orientation);
  const content = new THREE.Group();orientation.add(content);
  const owned: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T): T => { owned.push(item);return item; };
  try {
  const paper = 0xfaf5e9;
  const coverMaterial = keep(new THREE.MeshStandardMaterial({color:journalAppearance.cover,roughness:journalAppearance.roughness}));
  function slab(width: number, height: number, depth: number, material: THREE.Material) {
    return new THREE.Mesh(keep(new RoundedBoxGeometry(width,height,depth,2,Math.min(.012,depth/3))),material);
  }
  const backCover = slab(1.06,H+.08,.035,coverMaterial);backCover.position.set(.5,0,-.055);content.add(backCover);
  // The left paper block follows the front cover throughout opening. Keeping it
  // flat while the cover turns exposes unsupported pages through the cover.
  const leftBlock = new THREE.Group();content.add(leftBlock);
  const edgeCanvas=document.createElement('canvas');edgeCanvas.width=64;edgeCanvas.height=256;const edgeContext=edgeCanvas.getContext('2d')!;
  edgeContext.fillStyle=journalAppearance.edgeCss;edgeContext.fillRect(0,0,64,256);
  for(let y=0;y<256;y+=4){edgeContext.fillStyle=y%12===0?'#cfc8bc':'#ddd6ca';edgeContext.fillRect(0,y,64,1);}
  const edgeMap=keep(new THREE.CanvasTexture(edgeCanvas));edgeMap.colorSpace=THREE.SRGBColorSpace;
  const edgeMaterial = keep(new THREE.MeshStandardMaterial({map:edgeMap,roughness:1}));
  const rightStack = new THREE.Mesh(keep(new THREE.BoxGeometry(W,H,.04,32,1,1)),edgeMaterial);rightStack.position.x=.5;content.add(rightStack);
  const leftStack = new THREE.Mesh(keep(new THREE.BoxGeometry(W,H,.04,32,1,1)),edgeMaterial);leftStack.position.x=-.5;leftBlock.add(leftStack);
  const spine = slab(.075,H+.08,.14,coverMaterial);spine.position.set(-.012,0,-.09);content.add(spine);
  const hinge = new THREE.Group();content.add(hinge);
  const lid = slab(1.06,H+.08,.028,coverMaterial);lid.position.set(.5,0,.065);hinge.add(lid);
  // At the drawer pose these dimensions become the same 0.22 × 0.07 label as
  // the room book. The unlit patch and lettering then survive the hand-off.
  const coverCanvas = document.createElement("canvas");coverCanvas.width=1024;coverCanvas.height=384;
  const ctx=coverCanvas.getContext("2d")!;
  ctx.fillStyle=journalAppearance.coverCss;ctx.fillRect(0,0,coverCanvas.width,coverCanvas.height);
  ctx.fillStyle=journalAppearance.titleCss;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font=`600 ${Math.round(coverCanvas.height*.22)}px monospace`;
  ctx.fillText("JOURNAL",coverCanvas.width/2,coverCanvas.height/2,coverCanvas.width*.9);
  const coverTexture=keep(new THREE.CanvasTexture(coverCanvas));coverTexture.colorSpace=THREE.SRGBColorSpace;
  const title=new THREE.Mesh(keep(new THREE.PlaneGeometry(.56,.21)),keep(new THREE.MeshBasicMaterial({map:coverTexture})));title.position.set(.5,.195,.081);hinge.add(title);
  const lining=slab(.98,H-.015,.003,keep(new THREE.MeshStandardMaterial({color:journalAppearance.lining,roughness:1})));lining.position.set(.5,0,.049);hinge.add(lining);
  // Use the room lights so lifting the book does not illuminate nearby furniture.
  const leftMat=keep(new THREE.MeshStandardMaterial({color:paper,roughness:1})),rightMat=keep(new THREE.MeshStandardMaterial({color:paper,roughness:1}));
  const left=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H,32,2)),leftMat);left.position.x=-.5;leftBlock.add(left);
  const right=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H,32,2)),rightMat);right.position.x=.5;content.add(right);
  const stackWeights=[leftStack,rightStack].map(mesh=>Array.from(mesh.geometry.getAttribute('position').array).filter((_,i)=>i%3===2).map(z=>(z+.02)/.04));
  let paperShape=-1;
  function shapePaper(amount:number){
    if(paperShape===amount)return;paperShape=amount;
    for(const [index,side] of [-1,1].entries()){
      const top=(x:number)=>{const edge=x*side+.5;return THREE.MathUtils.lerp(-.001,.012+.018*Math.sin(Math.PI*edge)-.012*Math.exp(-edge*18),amount);};
      const surface=[left,right][index].geometry,stack=[leftStack,rightStack][index].geometry;
      for(const geometry of [surface,stack]){
        const positions=geometry.getAttribute('position');
        // Keep the printed surface just above the solid block, avoiding coplanar
        // depth fighting when the book is viewed at an oblique angle.
        for(let i=0;i<positions.count;i++)positions.setZ(i,geometry===surface?top(positions.getX(i))+.001:-.045+stackWeights[index][i]*(top(positions.getX(i))+.045));
        positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
      }
    }
  }
  const leaf=new THREE.Group();content.add(leaf);leaf.visible=false;
  const frontGeometry=keep(new THREE.PlaneGeometry(W,H,40,4));frontGeometry.translate(.5,0,0);
  const backGeometry=keep(frontGeometry.clone());
  const backUV=backGeometry.getAttribute("uv");for(let i=0;i<backUV.count;i++)backUV.setX(i,1-backUV.getX(i));
  const original=Float32Array.from(frontGeometry.getAttribute("position").array);
  const frontMat=keep(new THREE.MeshStandardMaterial({color:paper,side:THREE.FrontSide,roughness:1}));
  const backMat=keep(new THREE.MeshStandardMaterial({color:paper,side:THREE.BackSide,roughness:1}));
  leaf.add(new THREE.Mesh(frontGeometry,frontMat),new THREE.Mesh(backGeometry,backMat));
  const curlShadow=new THREE.Mesh(keep(new THREE.PlaneGeometry(1,H)),keep(new THREE.MeshBasicMaterial({color:0x4a3520,transparent:true,opacity:0,depthWrite:false})));curlShadow.position.set(.5,0,.018);content.add(curlShadow);
  const gutterCanvas=document.createElement('canvas');gutterCanvas.width=128;gutterCanvas.height=4;
  const gutterContext=gutterCanvas.getContext('2d')!;
  const gradient=gutterContext.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'rgba(64,43,23,0)');gradient.addColorStop(.47,'rgba(64,43,23,.16)');gradient.addColorStop(.5,'rgba(35,26,18,.4)');gradient.addColorStop(.53,'rgba(64,43,23,.16)');gradient.addColorStop(1,'rgba(64,43,23,0)');gutterContext.fillStyle=gradient;gutterContext.fillRect(0,0,128,4);
  const gutterMap=keep(new THREE.CanvasTexture(gutterCanvas));gutterMap.colorSpace=THREE.SRGBColorSpace;
  const gutter=new THREE.Mesh(keep(new THREE.PlaneGeometry(.14,H)),keep(new THREE.MeshBasicMaterial({map:gutterMap,transparent:true,depthWrite:false,toneMapped:false})));gutter.position.z=.019;content.add(gutter);
  return {
    root, orientation, content, owned, paper, backCover, leftBlock, rightStack, spine,
    hinge, lid, leftMat, rightMat, left, right, frontGeometry, backGeometry,
    frontMat, backMat, leaf, curlShadow, gutter, shapePaper, original,
  };
  } catch (error) {
    disposeSafely([...owned.map(resource => () => resource.dispose()), () => scene.remove(root)]);
    throw error;
  }
}
