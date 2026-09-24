import * as THREE from "three";
import { journalAppearance } from "./journalAppearance";
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { spreadFor, turnFaces } from "../../features/journal/book-state";
import type { JournalManifest, JournalRegion } from "../../features/journal/types";
import { clamp, constrainReading, journalSingle, type JournalPhase } from '../../features/journal/inspection';

export type BookReport = { page: number; single: boolean; busy: boolean; error: string; textures: number; phase: JournalPhase; zoom: number };
const W = 1, H = 594 / 420;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Book geometry shares the studio renderer and on-demand animation loop. */
export function createJournalBook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, requestDraw: () => void) {
  const root = new THREE.Group();root.visible = false;scene.add(root);
  const orientation = new THREE.Group();root.add(orientation);
  const content = new THREE.Group();orientation.add(content);
  const owned: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T): T => { owned.push(item);return item; };
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
  const coverCanvas = document.createElement("canvas");coverCanvas.width=512;coverCanvas.height=128;
  const ctx=coverCanvas.getContext("2d")!;ctx.fillStyle=journalAppearance.titleCss;ctx.font="22px sans-serif";ctx.textAlign="center";ctx.fillText("JOURNAL",256,75);
  const coverTexture=keep(new THREE.CanvasTexture(coverCanvas));coverTexture.colorSpace=THREE.SRGBColorSpace;
  const title=new THREE.Mesh(keep(new THREE.PlaneGeometry(.62,.155)),keep(new THREE.MeshStandardMaterial({map:coverTexture,transparent:true,roughness:.8,metalness:.1})));title.position.set(.5,.16,.081);hinge.add(title);
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
  const cache=new Map<number,THREE.Texture>();const loading=new Map<number,Promise<void>>();
  let generation=0, book:JournalManifest|undefined, page=0, single=false, opened=0, active=false, disposed=false, error="", zoom=1;
  let phase:JournalPhase='observing', pitch=-.12,yaw=-.3,roll=-.035,travelAmount=0;
  const pan=new THREE.Vector2();
  let opening:{from:number;to:number;start:number;duration:number;resolve:()=>void}|undefined;
  let report: (state:BookReport)=>void=()=>{}, region: (item:JournalRegion)=>void=()=>{};
  let turning: ReturnType<typeof turnFaces>|undefined;
  let progress=0, tween:{from:number;to:number;start:number;duration:number;commit:boolean}|undefined;
  let drag:{id:number;x:number;y:number;lastX:number;lastY:number;direction:1|-1|0;kind:'turn'|'rotate'|'pan';moved:boolean}|undefined;
  const pointers=new Map<number,THREE.Vector2>();let pinch:{distance:number;zoom:number;center:THREE.Vector2}|undefined;
  const events=new AbortController(),canvas=renderer.domElement;
  const ray=new THREE.Raycaster();
  function emit(){ report({page,single,busy:Boolean(turning||opening),error,textures:cache.size,phase,zoom});canvas.dataset.journalPage=String(page);canvas.dataset.journalTextures=String(cache.size);canvas.dataset.journalBusy=String(Boolean(turning||opening));canvas.dataset.journalPhase=phase;canvas.dataset.journalZoom=String(zoom);canvas.dataset.journalYaw=String(yaw);canvas.dataset.journalPitch=String(pitch);canvas.dataset.journalPan=`${pan.x},${pan.y}`; }
  function apply(material:THREE.MeshStandardMaterial,index:number|undefined){material.map=index===undefined?null:cache.get(index)??null;material.color.setHex(material.map?0xffffff:paper);material.needsUpdate=true;}
  function visiblePages(){return spreadFor(page,book?.pages.length??0,single);}
  function updatePages(){
    if(turning){emit();requestDraw();return;}
    const indices=visiblePages();apply(leftMat,single?undefined:indices[0]);apply(rightMat,single?indices[0]:indices[1]);
    emit();requestDraw();
  }
  async function load(index:number){
    if(!book?.pages[index]||cache.has(index))return;
    if(loading.has(index))return loading.get(index);
    const version=generation;
    const pending=new THREE.TextureLoader().loadAsync(book.pages[index].image).then(texture=>{
      if(disposed||version!==generation){texture.dispose();return;}
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      cache.set(index,texture);updatePages();
    }).catch(()=>{if(version===generation){error="书页加载失败，请重试或使用文字阅读。";emit();}}).finally(()=>{if(version===generation)loading.delete(index);});
    loading.set(index,pending);return pending;
  }
  async function warm(){
    if(!book||!active)return;
    const center=single?page:page-page%2;
    const wanted=new Set<number>();
    for(let i=Math.max(0,center-4);i<Math.min(book.pages.length,center+6);i++)wanted.add(i);
    for(const [i,t] of cache)if(!wanted.has(i)){t.dispose();cache.delete(i);}
    await Promise.all([...wanted].map(load));updatePages();
  }
  function deform(value:number){
    progress=value;
    for(const geometry of [frontGeometry,backGeometry]){
      const positions=geometry.getAttribute("position");
      for(let i=0;i<positions.count;i++){
        const x=original[i*3],y=original[i*3+1];
        const angle=Math.PI*value+Math.sin(Math.PI*value)*.65*(x-.25);
        positions.setXYZ(i,x*Math.cos(angle),y,x*Math.sin(angle)+.03);
      }
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    }
    leaf.position.x=single?value:0;
    (curlShadow.material as THREE.MeshBasicMaterial).opacity=single?0:Math.sin(Math.PI*value)*.12;
    curlShadow.position.x=value<.5?.5:-.5;
    requestDraw();
  }
  function releasePointers(){for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();pinch=undefined;drag=undefined;}
  function cancel(){turning=undefined;tween=undefined;releasePointers();leaf.visible=false;(curlShadow.material as THREE.MeshBasicMaterial).opacity=0;updatePages();}
  function stopOpening(){if(opening){const pending=opening;opening=undefined;opened=pending.to;phase=opened?'reading':'observing';pending.resolve();}}
  function resetView(straight=false){pitch=straight?0:phase==='observing'?-.12:-.1;yaw=straight?0:phase==='observing'?-.3:.08;roll=straight?0:-.025;zoom=1;pan.set(0,0);emit();requestDraw();}
  function open(value:boolean,reduced=false){
    cancel();stopOpening();phase=value?'opening':'closing';resetView();
    if(value){pitch=-.1;yaw=.08;}else{pitch=-.12;yaw=-.3;}
    if(reduced){opened=value?1:0;phase=value?'reading':'observing';emit();requestDraw();return Promise.resolve();}
    const promise=new Promise<void>(resolve=>{opening={from:opened,to:value?1:0,start:performance.now(),duration:reduced?0:750,resolve};});
    emit();requestDraw();return promise;
  }
  function setZoom(value:number){zoom=clamp(value,1,2.4);if(zoom===1)pan.set(0,0);emit();requestDraw();}
  function begin(direction:1|-1){
    if(!active||phase!=='reading'||travelAmount<1||turning||!book)return false;
    const turn=turnFaces(page,book.pages.length,single,direction);if(!turn)return false;
    const required=[turn.front,turn.back,turn.to,turn.to+1].filter(i=>book!.pages[i]);
    if(required.some(i=>!cache.has(i))){void warm();return false;}
    turning=turn;
    if(single){apply(frontMat,direction===1?page:turn.to);apply(backMat,direction===1?turn.to:page);left.visible=false;right.visible=false;}
    else {apply(frontMat,turn.front);apply(backMat,turn.back);if(direction===1)apply(rightMat,turn.to+1);else apply(leftMat,turn.to);}
    leaf.visible=true;deform(direction===1?0:1);emit();return true;
  }
  function finish(commit:boolean,reduced=false){
    if(!turning)return;
    const target=commit?(turning.direction===1?1:0):(turning.direction===1?0:1);
    tween={from:progress,to:target,start:performance.now(),duration:reduced?0:Math.max(120,Math.abs(target-progress)*650),commit};requestDraw();
  }
  function hit(event:PointerEvent){
    // A button can change the pose between render frames. Hit-test the new pose.
    orientation.rotation.set(pitch*travelAmount,yaw*travelAmount,roll*travelAmount,'YXZ');
    root.updateWorldMatrix(true,true);
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return ray.intersectObjects(phase==='observing'?[lid,backCover,spine,rightStack]:single?[right]:[left,right])[0];
  }
  const canInteract=()=>active&&travelAmount===1&&!opening&&!document.querySelector('[data-journal-text]:not([hidden])')&&!document.querySelector('[data-journal-image][open]');
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas.addEventListener("pointerdown",event=>{
    if(!canInteract()||event.button!==0)return;
    if(pointers.size){
      pointers.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));
      canvas.setPointerCapture(event.pointerId);
      if(turning){turning=undefined;tween=undefined;leaf.visible=false;updatePages();}
      drag=undefined;const [a,b]=[...pointers.values()];pinch={distance:a.distanceTo(b),zoom,center:a.clone().add(b).multiplyScalar(.5)};event.preventDefault();return;
    }
    if(turning)return;
    const found=hit(event);if(!found?.uv)return;
    const {x,y}=found.uv;
    const direction=phase==='reading'&&(y<.2||y>.8)?(single?(x>.84?1:x<.16?-1:0):(found.object===right&&x>.84?1:found.object===left&&x<.16?-1:0)):0;
    const kind=direction?'turn':zoom>1.05||event.shiftKey?'pan':'rotate';
    if(direction&&!begin(direction))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,direction,kind,moved:false};
    pointers.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));canvas.setPointerCapture(event.pointerId);event.preventDefault();
  },{signal:events.signal});
  canvas.addEventListener("pointermove",event=>{
    if(pointers.has(event.pointerId))pointers.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));
    if(pinch&&pointers.size>=2){const [a,b]=[...pointers.values()];setZoom(pinch.zoom*a.distanceTo(b)/Math.max(1,pinch.distance));const center=a.clone().add(b).multiplyScalar(.5);pan.x+= (center.x-pinch.center.x)*.002;pan.y-= (center.y-pinch.center.y)*.002;pan.clampScalar(-.8,.8);pinch.center.copy(center);emit();requestDraw();return;}
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6)drag.moved=true;
    if(!drag.moved)return;
    const dx=event.clientX-drag.lastX,dy=event.clientY-drag.lastY;drag.lastX=event.clientX;drag.lastY=event.clientY;
    if(drag.kind==='turn'){
      const distance=Math.max(150,canvas.clientWidth*(single?.65:.3));
      const amount=clamp((drag.x-event.clientX)*drag.direction/distance,0,1);deform(drag.direction===1?amount:1-amount);
    }else if(drag.kind==='pan'){pan.x=clamp(pan.x+dx*.002,-.8,.8);pan.y=clamp(pan.y-dy*.002,-.8,.8);}
    else{yaw+=dx*.007;pitch+=dy*.007;if(phase==='reading')({pitch,yaw}=constrainReading(pitch,yaw));}
    emit();requestDraw();
  },{signal:events.signal});
  canvas.addEventListener("pointerup",event=>{
    if(!active)return;
    pointers.delete(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(pinch){releasePointers();return;}
    if(!drag||drag.id!==event.pointerId)return;
    const gesture=drag;drag=undefined;
    if(gesture.kind==='turn'){const amount=gesture.direction===1?progress:1-progress;finish(!gesture.moved||amount>.35,reduced());return;}
    if(gesture.moved)return;
    if(phase==='observing'){if(hit(event)?.object===lid)void open(true,reduced());return;}
    if(turning||phase!=='reading')return;
    const found=hit(event);if(!found?.uv||!book)return;
    const ids=visiblePages(),id=single?ids[0]:found.object===left?ids[0]:ids[1];
    const x=found.uv.x*420,y=(1-found.uv.y)*594;
    const target=book.pages[id]?.regions.find(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);if(target)region(target);
  },{signal:events.signal});
  canvas.addEventListener("pointercancel",()=>{releasePointers();finish(false,reduced());},{signal:events.signal});
  canvas.addEventListener('lostpointercapture',event=>{if(pointers.has(event.pointerId)){releasePointers();finish(false,reduced());}},{signal:events.signal});
  canvas.addEventListener('wheel',event=>{if(!canInteract()||turning)return;event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.001));},{signal:events.signal,passive:false});
  return {
    root,
    configure(manifest:JournalManifest,onReport:typeof report,onRegion:typeof region){book=manifest;report=onReport;region=onRegion;},
    activate(value:boolean){active=value;root.visible=value;if(!value){generation++;cancel();stopOpening();for(const t of cache.values())t.dispose();cache.clear();loading.clear();for(const material of [leftMat,rightMat,frontMat,backMat])apply(material,undefined);}else{error='';void warm();}emit();requestDraw();},
    prepare(reading:boolean){cancel();stopOpening();opened=reading?1:0;phase=reading?'reading':'observing';resetView();},
    open,
    resetView(){resetView(true);},
    setPage(index:number){page=Math.max(0,Math.min((book?.pages.length??1)-1,index));cancel();void warm();},
    resize(){const rect=canvas.getBoundingClientRect();const next=journalSingle(rect.width,rect.height);if(next!==single){single=next;cancel();void warm();}updatePages();},
    setZoom,
    pose(amount:number,origin:THREE.Vector3,rotation:THREE.Quaternion){
      travelAmount=amount;
      const distance=Math.min(3,Math.max(.8,camera.position.distanceTo(origin)*.45));
      const availableH=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      const width=single?1.14:THREE.MathUtils.lerp(1.14,2.2,opened);
      // The rising cover approaches the camera; reserve perspective headroom.
      const fit=Math.min(availableH*THREE.MathUtils.lerp(.58,.68,opened)/H,availableH*camera.aspect*.85/width)*zoom*(1-.22*Math.sin(Math.PI*opened));
      const end=new THREE.Vector3(0,.01,-distance).applyQuaternion(camera.quaternion).add(camera.position);
      // Leave the open drawer vertically at the object's real size before
      // rotating or enlarging. Retrace the same clearance path on return.
      const lifted=origin.clone();lifted.y=1.65;
      const clearance=lifted.clone();clearance.y=1.9;clearance.z=1.2;
      const travel=ease(clamp((amount-.55)/.45,0,1));
      if(amount<.28)root.position.lerpVectors(origin,lifted,ease(amount/.28));
      else if(amount<.55)root.position.lerpVectors(lifted,clearance,ease((amount-.28)/.27));
      else root.position.lerpVectors(clearance,end,travel);
      root.quaternion.slerpQuaternions(rotation,camera.quaternion,travel);
      root.scale.set(THREE.MathUtils.lerp(.39,fit,travel),THREE.MathUtils.lerp(.47/H,fit,travel),THREE.MathUtils.lerp(.4,fit,travel));
      canvas.dataset.journalTravel=String(amount);
      canvas.dataset.journalPosition=root.position.toArray().join(',');
      canvas.dataset.journalScale=root.scale.toArray().join(',');
      orientation.rotation.set(pitch*travel,yaw*travel,roll*travel,'YXZ');orientation.position.set(pan.x*travel,pan.y*travel,0);
      hinge.rotation.y=-Math.PI*opened;hinge.visible=single?opened<1:true;
      leftBlock.rotation.y=Math.PI*(1-opened);leftBlock.visible=!single||opened<1;
      // A closed spine spans both covers; unfolded it rests behind the gutter.
      spine.position.z=THREE.MathUtils.lerp(.00325,-.055,opened);
      spine.scale.z=THREE.MathUtils.lerp(.1515,.035,opened)/.14;
      shapePaper(opened);
      content.position.x=single?-.5:THREE.MathUtils.lerp(-.5,0,opened);
      gutter.visible=!single&&opened>.98;
      left.visible=!single;right.visible=opened>.01&&!(single&&turning);
    },
    turn(direction:1|-1,reduced:boolean){if(begin(direction))finish(true,reduced);},
    retry(){error="";void warm();},
    cancel(){cancel();stopOpening();emit();},
    tick(now:number){
      if(opening){const motion=opening;const t=motion.duration?Math.min(1,(now-motion.start)/motion.duration):1;opened=THREE.MathUtils.lerp(motion.from,motion.to,ease(t));if(t===1){opening=undefined;phase=motion.to?'reading':'observing';motion.resolve();emit();}return true;}
      if(!tween||!turning)return false;
      const t=tween.duration?Math.min(1,(now-tween.start)/tween.duration):1;
      deform(THREE.MathUtils.lerp(tween.from,tween.to,ease(t)));
      if(t===1){if(tween.commit)page=turning.to;cancel();void warm();}
      return Boolean(tween);
    },
    dispose(){disposed=true;generation++;cancel();stopOpening();events.abort();for(const t of cache.values())t.dispose();cache.clear();owned.forEach(o=>o.dispose());scene.remove(root);},
  };
}
