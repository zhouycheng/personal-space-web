import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { journalAppearance } from "../../../config/journalAppearance.ts";
import { disposeSafely } from "../../../infrastructure/client/dispose.ts";

const W = 1;
export const BOOK_HEIGHT = 594 / 420;
const H = BOOK_HEIGHT;
export const SHEET_THICKNESS = .0015;
export const singleSurfaceHeight = (edge: number) => .001 + .018 * Math.sin(Math.PI * edge);
export const singleBackDepth = (pages: number) => .085 + Math.ceil(pages / 2) * SHEET_THICKNESS;
export function journalSheetCounts(pages:number,page:number) {
  const total=Math.ceil(pages/2), back=Math.min(total,Math.floor(Math.max(0,page)/2));
  return {total,back,front:total-back};
}

export function paperSurfaceHeight(edge: number) {
  return .013 + .018 * Math.sin(Math.PI * edge) - .012 * Math.exp(-edge * 18);
}

export function shapeTurningPage(geometry: THREE.BufferGeometry, original: Float32Array, progress: number, direction: number, grip: { u: number; v: number; skew: number }) {
  const lift = Math.sin(Math.PI * progress), positions = geometry.getAttribute("position");
  // ponytail: bounded analytic bending with a fixed binding; arbitrary crumpling needs a shell solver.
  for (let i = 0; i < positions.count; i++) {
    const u = original[i * 3], y = original[i * 3 + 1], across = y / (H / 2);
    const proximity = Math.exp(-Math.abs(u - grip.u) * 3 - Math.abs(across - grip.v) * 1.5);
    const twist = THREE.MathUtils.clamp((u - .24) * .58 + (u - grip.u) * .22 + (across - grip.v) * (.22 + .16 * u) + grip.skew * .26 * u, -.42, .42);
    const angle = Math.PI * progress + lift * twist, x = direction * u * Math.cos(angle);
    const bendY = lift * .018 * u * grip.skew * (1 - Math.min(1, Math.abs(across - grip.v) * .25));
    const bendZ = lift * u * (.035 * (1 - u * .4) * Math.max(0, 1 - across * across) + .035 * proximity);
    // Follow the same curved stack at contact. Every lift term vanishes at the spine.
    positions.setXYZ(i, x, y + bendY, paperSurfaceHeight(Math.abs(x)) + .002 * u + u * Math.sin(angle) + bendZ);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
}

export function shapeFoldedPage(geometry: THREE.BufferGeometry, original: Float32Array, progress: number, grip: { u: number; v: number; skew: number }, depth = singleBackDepth(4)) {
  const positions = geometry.getAttribute('position'), t = THREE.MathUtils.clamp(progress, 0, 1);
  const radius = depth / 2, rootZ = singleSurfaceHeight(0);
  let rowY = NaN, x = 0, z = rootZ, previousU = 0;
  // ponytail: an inextensible strip per row, with bounded cross-row lag;
  // full sheet shear and arbitrary creases would require a shell solver.
  for (let i = 0; i < positions.count; i++) {
    const u = original[i * 3], y = original[i * 3 + 1], across = y / (H / 2);
    const lag = .022 * across * THREE.MathUtils.clamp(grip.v + grip.skew * .2, -1, 1);
    const phase = t + lag * Math.sin(Math.PI * t) ** 2;
    if (rowY !== y) { rowY = y; x = 0; z = rootZ; previousU = 0; }
    if (phase <= .5) {
      const angle = Math.PI * phase * 2, lift = Math.sin(angle);
      const middle = (previousU + u) / 2;
      const bow = .42 * Math.sin(Math.PI * phase) * Math.sin(Math.PI * middle);
      const tangent = angle + .48 * lift * (2 * middle - 1) - bow;
      x += (u - previousU) * Math.cos(tangent);
      z += (u - previousU) * Math.sin(tangent);
    } else {
      const angle = Math.PI * (phase - .5) * 2, binding = radius * angle;
      // The binding consumes real sheet length as it wraps around the spine.
      // Integrate its circular arc exactly; the outer panel retains a broad bow.
      const a = Math.min(previousU, binding), b = Math.min(u, binding);
      x -= radius * (Math.sin(b / radius) - Math.sin(a / radius));
      z += radius * (Math.cos(b / radius) - Math.cos(a / radius));
      if (u > binding) {
        const start = Math.max(previousU, binding), middle = (start + u) / 2;
        const bow = .42 * Math.sin(Math.PI * phase) * Math.sin(Math.PI * (middle - binding) / (1 - binding));
        const tangent = Math.PI + angle - bow;
        x += (u - start) * Math.cos(tangent);
        z += (u - start) * Math.sin(tangent);
      }
    }
    previousU = u;
    const frontRest = (singleSurfaceHeight(u) - rootZ + .0008*u) * (1 - THREE.MathUtils.smoothstep(phase, 0, .15));
    const backEdge = Math.max(0, (u - Math.PI * radius) / (1 - Math.PI * radius));
    const backRest = (singleSurfaceHeight(backEdge) - rootZ) * THREE.MathUtils.smoothstep(phase, .85, 1);
    positions.setXYZ(i, x, y, z + frontRest - backRest);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
}

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
  const foldedSpine = new THREE.Mesh(keep(new THREE.CylinderGeometry(.034,.034,H+.025,32,1,true,Math.PI,Math.PI)),coverMaterial);
  foldedSpine.position.z=-.044;foldedSpine.visible=false;content.add(foldedSpine);
  const singleSheets = new THREE.Group();singleSheets.visible=false;content.add(singleSheets);
  const sheetMaterial = keep(new THREE.MeshStandardMaterial({color:paper,roughness:1}));
  const sheetGeometry = keep(new THREE.BoxGeometry(1,H,SHEET_THICKNESS,32,1,1));
  const sheetPositions = sheetGeometry.getAttribute('position');
  for(let i=0;i<sheetPositions.count;i++) sheetPositions.setZ(i,sheetPositions.getZ(i)+singleSurfaceHeight(sheetPositions.getX(i)+.5)-.001);
  sheetGeometry.computeVertexNormals();
  const arcShape = new THREE.Shape();
  arcShape.absarc(0,0,1,Math.PI/2,Math.PI*1.5,false);
  arcShape.lineTo(0,-.985);arcShape.absarc(0,0,.985,Math.PI*1.5,Math.PI/2,true);arcShape.closePath();
  const arcGeometry = keep(new THREE.ExtrudeGeometry(arcShape,{depth:H,bevelEnabled:false,curveSegments:24}));
  arcGeometry.rotateX(Math.PI/2);arcGeometry.translate(0,H/2,0);
  let frontSheets: THREE.InstancedMesh | undefined, rearSheets: THREE.InstancedMesh | undefined, bindings: THREE.InstancedMesh | undefined;
  let sheetCount=0;
  function disposeSingleSheets() { for(const mesh of [frontSheets,rearSheets,bindings]) if(mesh){singleSheets.remove(mesh);mesh.dispose();} }
  function updateSingleSheets(pages:number,page:number,moving?:'front'|'back') {
    const {total:count,back:behind}=journalSheetCounts(pages,page), matrix=new THREE.Matrix4();
    if(count!==sheetCount){
      disposeSingleSheets();sheetCount=count;
      frontSheets=new THREE.InstancedMesh(sheetGeometry,sheetMaterial,count);
      rearSheets=new THREE.InstancedMesh(sheetGeometry,sheetMaterial,count);
      bindings=new THREE.InstancedMesh(arcGeometry,sheetMaterial,count);
      singleSheets.add(frontSheets,rearSheets,bindings);
    }
    if(!frontSheets||!rearSheets||!bindings)return;
    frontSheets.count=Math.max(0,count-behind-(moving==='front'?1:0));
    rearSheets.count=bindings.count=Math.max(0,behind-(moving==='back'?1:0));
    for(let i=0;i<count-behind;i++)frontSheets.setMatrixAt(i,matrix.makeScale(1,1,.9+.1*Math.exp(-i*.12)).setPosition(.5,0,-(i+.5)*SHEET_THICKNESS));
    for(let i=0;i<behind;i++){
      const z=.001-singleBackDepth(pages)+(behind-i-1)*SHEET_THICKNESS;
      const radius=(.001-z)/2;
      const width=1-Math.PI*radius;
      rearSheets.setMatrixAt(i,matrix.makeScale(width,-1,-(.9+.1*Math.exp(-i*.12))).setPosition(width/2,0,z));
      bindings.setMatrixAt(i,matrix.makeScale(radius,1,radius).setPosition(0,0,.001-radius));
    }
    for(const mesh of [frontSheets,rearSheets,bindings]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
    singleSheets.userData.frontSheets=count-behind;singleSheets.userData.rearSheets=behind;
  }
  const hinge = new THREE.Group();content.add(hinge);
  const lid = slab(1.06,H+.08,.028,coverMaterial);lid.position.set(.5,0,.065);hinge.add(lid);
  // Print the lettering on the cover without an unlit rectangular backing,
  // matching the tabletop book before and after reading.
  const coverCanvas = document.createElement("canvas");coverCanvas.width=1024;coverCanvas.height=384;
  const ctx=coverCanvas.getContext("2d")!;
  ctx.fillStyle=journalAppearance.titleCss;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font=`600 ${Math.round(coverCanvas.height*.22)}px monospace`;
  ctx.fillText("JOURNAL",coverCanvas.width/2,coverCanvas.height/2,coverCanvas.width*.9);
  const coverTexture=keep(new THREE.CanvasTexture(coverCanvas));coverTexture.colorSpace=THREE.SRGBColorSpace;
  const titleMaterial=keep(new THREE.MeshStandardMaterial({map:coverTexture,roughness:journalAppearance.roughness,transparent:true,depthWrite:false}));
  const title=new THREE.Mesh(keep(new THREE.PlaneGeometry(.56,.21)),titleMaterial);title.position.set(.5,.195,.081);title.receiveShadow=true;hinge.add(title);
  const lining=slab(.98,H-.015,.003,keep(new THREE.MeshStandardMaterial({color:journalAppearance.lining,roughness:1})));lining.position.set(.5,0,.049);hinge.add(lining);
  // Use the room lights so lifting the book does not illuminate nearby furniture.
  const leftMat=keep(new THREE.MeshStandardMaterial({color:paper,roughness:1})),rightMat=keep(new THREE.MeshStandardMaterial({color:paper,roughness:1}));
  const left=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H,32,2)),leftMat);left.position.x=-.5;leftBlock.add(left);
  const right=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H,32,2)),rightMat);right.position.x=.5;content.add(right);
  const stackWeights=[leftStack,rightStack].map(mesh=>Array.from(mesh.geometry.getAttribute('position').array).filter((_,i)=>i%3===2).map(z=>(z+.02)/.04));
  let paperShape=-1, paperFold=-1;
  function shapePaper(amount:number,fold=0){
    if(paperShape===amount&&paperFold===fold)return;paperShape=amount;paperFold=fold;
    for(const [index,side] of [-1,1].entries()){
      const top=(x:number)=>THREE.MathUtils.lerp(-.001,THREE.MathUtils.lerp(paperSurfaceHeight(x*side+.5),singleSurfaceHeight(x*side+.5),fold)-.001,amount);
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
  const frontGeometry=keep(new THREE.PlaneGeometry(W,H,64,24));frontGeometry.translate(.5,0,0);
  const backGeometry=keep(frontGeometry.clone());
  const backUV=backGeometry.getAttribute("uv");for(let i=0;i<backUV.count;i++)backUV.setX(i,1-backUV.getX(i));
  const original=Float32Array.from(frontGeometry.getAttribute("position").array);
  const frontMat=keep(new THREE.MeshStandardMaterial({color:paper,side:THREE.FrontSide,roughness:1}));
  const backMat=keep(new THREE.MeshStandardMaterial({color:paper,side:THREE.BackSide,roughness:1}));
  leaf.add(new THREE.Mesh(frontGeometry,frontMat),new THREE.Mesh(backGeometry,backMat));
  const curlShadow=new THREE.Mesh(keep(new THREE.PlaneGeometry(1,H)),keep(new THREE.MeshBasicMaterial({color:0x4a3520,transparent:true,opacity:0,depthWrite:false})));curlShadow.position.set(.5,0,.018);content.add(curlShadow);
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=4;
  const contactContext=contactCanvas.getContext('2d')!;
  const contactGradient=contactContext.createLinearGradient(0,0,128,0);
  contactGradient.addColorStop(0,'rgba(49,35,22,.22)');contactGradient.addColorStop(.35,'rgba(49,35,22,.035)');
  contactGradient.addColorStop(.75,'rgba(49,35,22,.05)');contactGradient.addColorStop(1,'rgba(49,35,22,.18)');
  contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,4);
  const contactMap=keep(new THREE.CanvasTexture(contactCanvas));
  const contactShadow=new THREE.Mesh(keep(new THREE.PlaneGeometry(1,H)),keep(new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,toneMapped:false})));
  contactShadow.position.x=.5;contactShadow.visible=false;content.add(contactShadow);
  const gutterCanvas=document.createElement('canvas');gutterCanvas.width=128;gutterCanvas.height=4;
  const gutterContext=gutterCanvas.getContext('2d')!;
  const gradient=gutterContext.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'rgba(64,43,23,0)');gradient.addColorStop(.47,'rgba(64,43,23,.16)');gradient.addColorStop(.5,'rgba(35,26,18,.4)');gradient.addColorStop(.53,'rgba(64,43,23,.16)');gradient.addColorStop(1,'rgba(64,43,23,0)');gutterContext.fillStyle=gradient;gutterContext.fillRect(0,0,128,4);
  const gutterMap=keep(new THREE.CanvasTexture(gutterCanvas));gutterMap.colorSpace=THREE.SRGBColorSpace;
  const gutter=new THREE.Mesh(keep(new THREE.PlaneGeometry(.14,H)),keep(new THREE.MeshBasicMaterial({map:gutterMap,transparent:true,depthWrite:false,toneMapped:false})));gutter.position.z=.019;content.add(gutter);
  return {
    root, orientation, content, owned, paper, backCover, leftBlock, leftStack, rightStack, spine, foldedSpine, singleSheets, updateSingleSheets, disposeSingleSheets,
    hinge, lid, leftMat, rightMat, left, right, frontGeometry, backGeometry,
    frontMat, backMat, leaf, curlShadow, contactShadow, gutter, shapePaper, original,
  };
  } catch (error) {
    disposeSafely([...owned.map(resource => () => resource.dispose()), () => scene.remove(root)]);
    throw error;
  }
}
