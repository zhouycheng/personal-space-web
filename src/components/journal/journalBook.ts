import * as THREE from "three";
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { spreadFor, turnFaces } from "../../features/journal/book-state";
import type { JournalManifest, JournalRegion } from "../../features/journal/types";

export type BookReport = { page: number; single: boolean; busy: boolean; error: string; textures: number };
const W = 1, H = 594 / 420;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Book geometry shares the studio renderer and on-demand animation loop. */
export function createJournalBook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, requestDraw: () => void) {
  const root = new THREE.Group();root.visible = false;scene.add(root);
  const content = new THREE.Group();root.add(content);
  const owned: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T): T => { owned.push(item);return item; };
  const paper = 0xfaf5e9;
  const leather = keep(new THREE.MeshStandardMaterial({ color: 0x3b241a, roughness: .93 }));
  function slab(width: number, height: number, depth: number, material: THREE.Material) {
    return new THREE.Mesh(keep(new RoundedBoxGeometry(width,height,depth,2,Math.min(.012,depth/3))),material);
  }
  const backCover = slab(1.06,H+.08,.035,leather);backCover.position.set(.5,0,-.055);content.add(backCover);
  const leftCover = slab(1.06,H+.08,.035,leather);leftCover.position.set(-.5,0,-.055);content.add(leftCover);
  const edgeMaterial = keep(new THREE.MeshStandardMaterial({color:0xdfd4c0,roughness:1}));
  const rightStack = slab(.994,H-.006,.04,edgeMaterial);rightStack.position.set(.5,0,-.025);content.add(rightStack);
  const leftStack = slab(.994,H-.006,.04,edgeMaterial);leftStack.position.set(-.5,0,-.025);content.add(leftStack);
  const spine = slab(.045,H+.08,.09,leather);spine.position.set(0,0,-.04);content.add(spine);
  const ribbon = slab(.025,.24,.003,keep(new THREE.MeshBasicMaterial({color:0x9d703d})));ribbon.position.set(.75,-H/2-.065,-.02);content.add(ribbon);
  const hinge = new THREE.Group();content.add(hinge);
  const lid = slab(1.06,H+.08,.028,leather);lid.position.set(.5,0,.045);hinge.add(lid);
  const coverCanvas = document.createElement("canvas");coverCanvas.width=512;coverCanvas.height=128;
  const ctx=coverCanvas.getContext("2d")!;ctx.fillStyle="#70432d";ctx.fillRect(0,0,512,128);ctx.fillStyle="#dbc191";ctx.font="32px Georgia";ctx.textAlign="center";ctx.fillText("J O U R N A L",256,75);
  const coverTexture=keep(new THREE.CanvasTexture(coverCanvas));coverTexture.colorSpace=THREE.SRGBColorSpace;
  const title=new THREE.Mesh(keep(new THREE.PlaneGeometry(.72,.18)),keep(new THREE.MeshBasicMaterial({map:coverTexture})));title.position.set(.5,.12,.061);hinge.add(title);
  const shade=new THREE.Mesh(keep(new THREE.PlaneGeometry(40,40)),keep(new THREE.MeshBasicMaterial({color:0x172022,transparent:true,opacity:0,depthWrite:false})));shade.position.z=-.3;root.add(shade);
  const leftMat=keep(new THREE.MeshBasicMaterial({color:paper,toneMapped:false})),rightMat=keep(new THREE.MeshBasicMaterial({color:paper,toneMapped:false}));
  const left=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H)),leftMat);left.position.set(-.5,0,.012);content.add(left);
  const right=new THREE.Mesh(keep(new THREE.PlaneGeometry(W,H)),rightMat);right.position.set(.5,0,.012);content.add(right);
  const leaf=new THREE.Group();content.add(leaf);leaf.visible=false;
  const frontGeometry=keep(new THREE.PlaneGeometry(W,H,40,4));frontGeometry.translate(.5,0,0);
  const backGeometry=keep(frontGeometry.clone());
  const backUV=backGeometry.getAttribute("uv");for(let i=0;i<backUV.count;i++)backUV.setX(i,1-backUV.getX(i));
  const original=Float32Array.from(frontGeometry.getAttribute("position").array);
  const frontMat=keep(new THREE.MeshBasicMaterial({color:paper,side:THREE.FrontSide,toneMapped:false}));
  const backMat=keep(new THREE.MeshBasicMaterial({color:paper,side:THREE.BackSide,toneMapped:false}));
  leaf.add(new THREE.Mesh(frontGeometry,frontMat),new THREE.Mesh(backGeometry,backMat));
  const curlShadow=new THREE.Mesh(keep(new THREE.PlaneGeometry(1,H)),keep(new THREE.MeshBasicMaterial({color:0x4a3520,transparent:true,opacity:0,depthWrite:false})));curlShadow.position.set(.5,0,.018);content.add(curlShadow);
  const gutterCanvas=document.createElement('canvas');gutterCanvas.width=128;gutterCanvas.height=4;
  const gutterContext=gutterCanvas.getContext('2d')!;
  const gradient=gutterContext.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'rgba(64,43,23,0)');gradient.addColorStop(.47,'rgba(64,43,23,.16)');gradient.addColorStop(.5,'rgba(35,26,18,.4)');gradient.addColorStop(.53,'rgba(64,43,23,.16)');gradient.addColorStop(1,'rgba(64,43,23,0)');gutterContext.fillStyle=gradient;gutterContext.fillRect(0,0,128,4);
  const gutterMap=keep(new THREE.CanvasTexture(gutterCanvas));gutterMap.colorSpace=THREE.SRGBColorSpace;
  const gutter=new THREE.Mesh(keep(new THREE.PlaneGeometry(.14,H)),keep(new THREE.MeshBasicMaterial({map:gutterMap,transparent:true,depthWrite:false,toneMapped:false})));gutter.position.z=.019;content.add(gutter);
  const cache=new Map<number,THREE.Texture>();const loading=new Map<number,Promise<void>>();
  let generation=0, book:JournalManifest|undefined, page=0, single=false, opened=0, active=false, disposed=false, error="", zoom=1;
  let report: (state:BookReport)=>void=()=>{}, region: (item:JournalRegion)=>void=()=>{};
  let turning: ReturnType<typeof turnFaces>|undefined;
  let progress=0, tween:{from:number;to:number;start:number;duration:number;commit:boolean}|undefined;
  let drag:{id:number;x:number;direction:1|-1}|undefined;
  const events=new AbortController(),canvas=renderer.domElement;
  const ray=new THREE.Raycaster();
  function emit(){ report({page,single,busy:Boolean(turning),error,textures:cache.size});canvas.dataset.journalPage=String(page);canvas.dataset.journalTextures=String(cache.size);canvas.dataset.journalBusy=String(Boolean(turning)); }
  function apply(material:THREE.MeshBasicMaterial,index:number|undefined){material.map=index===undefined?null:cache.get(index)??null;material.color.setHex(material.map?0xffffff:paper);material.needsUpdate=true;}
  function visiblePages(){return spreadFor(page,book?.pages.length??0,single);}
  function updatePages(){
    if(turning){emit();requestDraw();return;}
    const indices=visiblePages();apply(leftMat,single?undefined:indices[0]);apply(rightMat,single?indices[0]:indices[1]);
    left.visible=!single;leftCover.visible=!single;leftStack.visible=!single;gutter.visible=!single;
    content.position.x=single?-.5:0;
    hinge.visible=opened<1;
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
  function cancel(){turning=undefined;tween=undefined;drag=undefined;leaf.visible=false;(curlShadow.material as THREE.MeshBasicMaterial).opacity=0;right.visible=true;updatePages();}
  function begin(direction:1|-1){
    if(!active||opened<1||turning||!book)return false;
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
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return ray.intersectObjects(single?[right]:[left,right])[0];
  }
  canvas.addEventListener("pointerdown",event=>{
    if(!active||opened<1||turning||event.button!==0||document.querySelector('[data-journal-text]:not([hidden])'))return;
    const found=hit(event);if(!found?.uv)return;
    const x=found.uv.x;
    const direction=single?(x>.82?1:x<.18?-1:0):(found.object===right&&x>.82?1:found.object===left&&x<.18?-1:0);
    if(direction&&begin(direction)){drag={id:event.pointerId,x:event.clientX,direction};canvas.setPointerCapture(event.pointerId);event.preventDefault();}
  },{signal:events.signal});
  canvas.addEventListener("pointermove",event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const distance=Math.max(150,canvas.clientWidth*(single?.7:.35));
    const amount=Math.max(0,Math.min(1,(drag.x-event.clientX)*drag.direction/distance));
    deform(drag.direction===1?amount:1-amount);
  },{signal:events.signal});
  canvas.addEventListener("pointerup",event=>{
    if(!active)return;
    if(drag?.id===event.pointerId){const moved=Math.abs(event.clientX-drag.x);const amount=drag.direction===1?progress:1-progress;drag=undefined;finish(moved<6||amount>.35,matchMedia('(prefers-reduced-motion: reduce)').matches);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return;}
    if(turning||opened<1)return;
    const found=hit(event);if(!found?.uv||!book)return;
    const ids=visiblePages(),id=single?ids[0]:found.object===left?ids[0]:ids[1];
    const x=found.uv.x*420,y=(1-found.uv.y)*594;
    const target=book.pages[id]?.regions.find(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);if(target)region(target);
  },{signal:events.signal});
  canvas.addEventListener("pointercancel",()=>{drag=undefined;finish(false);},{signal:events.signal});
  return {
    root,
    configure(manifest:JournalManifest,onReport:typeof report,onRegion:typeof region){book=manifest;report=onReport;region=onRegion;},
    activate(value:boolean){active=value;root.visible=value;if(!value){generation++;cancel();for(const t of cache.values())t.dispose();cache.clear();loading.clear();for(const material of [leftMat,rightMat,frontMat,backMat])apply(material,undefined);}else{error='';void warm();}emit();requestDraw();},
    setPage(index:number){page=Math.max(0,Math.min((book?.pages.length??1)-1,index));cancel();void warm();},
    resize(){const rect=canvas.getBoundingClientRect();const next=rect.width<760||rect.width/rect.height<1.1;if(next!==single){single=next;cancel();void warm();}updatePages();},
    setZoom(value:number){zoom=value;requestDraw();},
    pose(amount:number,origin:THREE.Vector3,rotation:THREE.Quaternion){
      opened=Math.max(0,Math.min(1,(amount-.5)*2));
      const distance=3;
      const availableH=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      const fit=Math.min(availableH*(single?.69:.60)/H,availableH*camera.aspect*(single?.88:.9)/(single?1.1:2.2))*zoom;
      const end=new THREE.Vector3(0,.01,-distance).applyQuaternion(camera.quaternion).add(camera.position);
      const travel=ease(Math.min(1,amount/.7));
      root.position.lerpVectors(origin,end,travel);root.quaternion.slerpQuaternions(rotation,camera.quaternion,travel);root.scale.setScalar(THREE.MathUtils.lerp(.4,fit,travel));
      hinge.rotation.y=-Math.PI*opened;hinge.visible=opened<1;
      content.position.x=single?-.5:THREE.MathUtils.lerp(-.5,0,opened);
      leftCover.visible=!single&&opened>.85;leftStack.visible=!single&&opened>.25;gutter.visible=!single&&opened>.7;
      left.visible=!single&&opened>.25;right.visible=opened>.25&&!(single&&turning);
      (shade.material as THREE.MeshBasicMaterial).opacity=amount*.62;
    },
    turn(direction:1|-1,reduced:boolean){if(begin(direction))finish(true,reduced);},
    retry(){error="";void warm();},
    cancel,
    tick(now:number){
      if(!tween||!turning)return false;
      const t=tween.duration?Math.min(1,(now-tween.start)/tween.duration):1;
      deform(THREE.MathUtils.lerp(tween.from,tween.to,ease(t)));
      if(t===1){if(tween.commit)page=turning.to;cancel();void warm();}
      return Boolean(tween);
    },
    dispose(){disposed=true;generation++;events.abort();for(const t of cache.values())t.dispose();cache.clear();owned.forEach(o=>o.dispose());scene.remove(root);},
  };
}
