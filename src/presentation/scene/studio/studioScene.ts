import * as THREE from "three";
import { createStudioObjects } from "./studioObjects";
import { chairTurn } from "../../../animation/studio/chairMotion";
import { ACTION_LABELS, type StudioAction } from "../../../contracts/studio";
import type { studioLighting } from "../../../config/studioTime";
import { smooth, surfaceDistance, surfacePhases, wheelZoom, clampRoomZoom, clampRoomAngle, clampRoomElevation, roomCameraStep, DEFAULT_ROOM_VIEW, ROOM_ZOOM_MAX } from "../../../animation/studio/studioMotion";
import { clockText } from "../../../config/studioTime";
import { stepRoomView, type RoomView, type RoomViewAction } from "../../../animation/studio/studioMotion";
import { StudioFailure, studioFailure } from "../../../application/studio/studioFailure";
import type { StudioSceneFile } from "../../../contracts/studio";
import { createJournalBook } from "../journal/journalBook";
import type { JournalManifest, JournalRegion, BookReport } from "../../../contracts/journal";
import { createStudioGestureController } from "../../interaction/studio/sceneGestures";

export type StudioScene = ReturnType<typeof createStudioScene>;

export function createStudioScene(mount: HTMLElement, onAction: (action: StudioAction) => void, onFailure: (error:StudioFailure) => void, onViewChange: (view:RoomView)=>void = ()=>{}, onReady:()=>void = ()=>{}, lightweight=false, studioFiles: readonly StudioSceneFile[] = []) {
  const cleanup: (()=>void)[] = [];
  const canvas = document.createElement("canvas");
  let creationError="";
  canvas.addEventListener("webglcontextcreationerror",event=>{creationError=(event as WebGLContextEvent).statusMessage;});
  let renderer:THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lightweight, alpha: true });
  } catch(error) {
    canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    throw new StudioFailure("context", creationError || error);
  }
  cleanup.push(()=>{renderer.dispose();if(!renderer.getContext().isContextLost())renderer.forceContextLoss();canvas.remove();});
  try {
  renderer.setPixelRatio(Math.min(devicePixelRatio, lightweight?1:1.5));
  renderer.shadowMap.enabled = !lightweight;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(0xeee9de, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  canvas.setAttribute("aria-label", "工作室场景，滚轮缩放，拖动改变视角，点击物件探索；Tab 键可访问内容和缩放入口");
  canvas.tabIndex = -1;
  mount.append(canvas);
  const scene = new THREE.Scene();
  const room = new THREE.Group(); scene.add(room);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const focus = new THREE.Vector3(-0.3, 1.05, -0.65);
  const events = new AbortController();
  cleanup.push(()=>events.abort());
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const releaseResources=()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
  cleanup.push(releaseResources);
  const tooltip = mount.querySelector<HTMLElement>("[data-studio-tooltip]")!;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = true;
  let destroyed = false;
  let failed = false;
  let frame = 0;
  cleanup.push(()=>cancelAnimationFrame(frame));
  let ready=false;
  let shaderError:StudioFailure|undefined;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
    shaderError=new StudioFailure("shader",[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join("\n"));
  };
  let angle = DEFAULT_ROOM_VIEW.angle;
  let elevation = DEFAULT_ROOM_VIEW.elevation;
  let roomZoom = DEFAULT_ROOM_VIEW.zoom, targetZoom = roomZoom;
  let targetAngle = angle, targetElevation = elevation;
  let cameraFrameTime: number | undefined;
  let zoomed = false;
  let motion: { start: number; duration: number; sample: (progress:number) => void; enter: boolean; resolve: () => void } | undefined;
  let chairElapsed: number | undefined;
  let chairFrameTime: number | undefined;
  const currentLook = focus.clone();

  const {
    drawerActions, drawers, diary, computerSurface, canvasSurface,
    chair, casters, chairWheels, steam, deskClock, clockImage, clockTexture,
    lampModel, diffuserMaterial, lamp, sun, ambient,
  } = createStudioObjects({ renderer, scene, room, studioFiles, materials, geometries, textures, cleanup });
  let steamElapsed=0,steamFrameTime:number|undefined;
  let displayedTime="";
  let clockDate=new Date(),showDate=false;
  let lampOn=true,lampPower=2;

  let journalBook:ReturnType<typeof createJournalBook>|undefined;
  let journalInteractionEnabled = true;
  let journalAmount=0,journalActive=false;
  const diaryRotation=new THREE.Quaternion(),diaryOrigin=new THREE.Vector3();
  function poseJournal() {
    if(!journalBook||!journalActive)return;
    diary.getWorldPosition(diaryOrigin);diary.getWorldQuaternion(diaryRotation);
    diaryRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
    journalBook.pose(journalAmount,diaryOrigin,diaryRotation);
  }
  cleanup.push(()=>journalBook?.dispose());

  function roomPosition() {
    const aspect=Math.max(0.3,mount.clientWidth/Math.max(1,mount.clientHeight));
    const distance=Math.max(8.5,8.5/aspect)/roomZoom;
    return new THREE.Vector3(Math.sin(angle)*distance,Math.sin(elevation)*distance,Math.cos(angle)*distance).add(roomLook());
  }
  function roomLook() {return focus.clone().lerp(new THREE.Vector3(-0.1,1.43,-1.25),smooth((roomZoom-1)/(ROOM_ZOOM_MAX-1)));}
  function roomInteractive() {return active&&!failed&&!destroyed&&!motion&&!zoomed&&!mount.closest<HTMLElement>("[data-studio]")?.inert;}
  function setRoomCamera() {camera.position.copy(roomPosition());currentLook.copy(roomLook());camera.lookAt(currentLook);mount.dataset.cameraZoom=roomZoom.toFixed(4);mount.dataset.cameraAngle=angle.toFixed(4);mount.dataset.cameraElevation=elevation.toFixed(4);}
  function cameraMoving() {return angle!==targetAngle||elevation!==targetElevation||roomZoom!==targetZoom;}
  function stopCamera() {cameraFrameTime=undefined;targetZoom=roomZoom;targetAngle=angle;targetElevation=elevation;onViewChange({zoom:roomZoom,angle,elevation});}
  function requestCamera() {
    clearHover();
    onViewChange({zoom:targetZoom,angle:targetAngle,elevation:targetElevation});
    if(reducedMotion.matches) {roomZoom=targetZoom;angle=targetAngle;elevation=targetElevation;setRoomCamera();}
    cameraFrameTime??=performance.now();requestDraw();
  }
  function changeZoom(value:number) {
    targetZoom=clampRoomZoom(value);requestCamera();
  }
  function draw(now:number) {
    frame=0;
    if(!active||destroyed||failed) return;
    if(cameraMoving()&&!motion&&!zoomed) {
      const elapsed=cameraFrameTime===undefined?0:now-cameraFrameTime;cameraFrameTime=now;
      roomZoom=roomCameraStep(roomZoom,targetZoom,elapsed);angle=roomCameraStep(angle,targetAngle,elapsed);elevation=roomCameraStep(elevation,targetElevation,elapsed);setRoomCamera();
    } else cameraFrameTime=undefined;
    const steamActive=roomInteractive()&&!reducedMotion.matches;
    steam.visible=steamActive;mount.dataset.steamActive=String(steamActive);
    if(steamActive) {
      steamElapsed+=steamFrameTime===undefined?0:Math.min(50,now-steamFrameTime);steamFrameTime=now;
      steam.children.forEach((object,index)=>{
        const puff=object as THREE.Sprite,t=(steamElapsed/3200+index/steam.children.length)%1;
        puff.position.set(Math.sin(t*7+index)*0.035*t,0.19+t*0.34,Math.cos(t*5+index)*0.025*t);
        puff.scale.set(0.025+t*0.085,0.065+t*0.18,1);
        puff.material.opacity=Math.sin(t*Math.PI)*0.42;
        puff.material.rotation=Math.sin(t*4+index)*0.3;
      });
    } else steamFrameTime=undefined;
    // Steam never changes shadows; only moving solid objects need a fresh map.
    if(chairElapsed!==undefined||drawers.some(drawer=>drawer.moving))renderer.shadowMap.needsUpdate=true;
    for(const drawer of drawers) {
      if(!drawer.moving) continue;
      drawer.elapsed+=drawer.frameTime===undefined?0:now-drawer.frameTime;drawer.frameTime=now;
      const t=reducedMotion.matches?1:Math.min(1,drawer.elapsed/420);
      drawer.group.position.z=-0.68+THREE.MathUtils.lerp(drawer.from,drawer.to,smooth(t));
      if(t===1) {drawer.moving=false;drawer.frameTime=undefined;}
    }
    if(chairElapsed!==undefined) {
      chairElapsed += chairFrameTime===undefined ? 0 : now-chairFrameTime;
      chairFrameTime=now;
      const turn=chairTurn(chairElapsed);
      const delta=turn.angle-chair.rotation.y;
      chair.rotation.y=turn.angle;
      const align=Math.min(1,chairElapsed/350);
      for(const caster of casters) caster.group.rotation.y=THREE.MathUtils.lerp(caster.startAngle,Math.PI/2,align*align*(3-2*align));
      for(const wheel of chairWheels) wheel.group.rotation.x=(wheel.group.rotation.x+delta*wheel.pathRadius/0.085)%(Math.PI*2);
      if(turn.done) {chair.rotation.y=0;chairElapsed=undefined;chairFrameTime=undefined;}
    }
    if(motion) {
      const t=Math.min(1,(now-motion.start)/Math.max(1,motion.duration));
      motion.sample(motion.enter?t:1-t);
      if(t===1) {const done=motion.resolve;motion=undefined;done();}
    }
    const journalMoving=journalBook?.tick(now);
    poseJournal();
    if(!render())return;
    if(active&&!frame&&(motion||journalMoving||cameraMoving()||steamActive||chairElapsed!==undefined||drawers.some(drawer=>drawer.moving))) frame=requestAnimationFrame(draw);
  }
  function requestDraw() {if(active&&!frame&&!destroyed&&!failed) frame=requestAnimationFrame(draw);}
  function fail(error:StudioFailure) {
    if(destroyed||failed)return;
    failed=true;ready=false;clearHover();cancelAnimationFrame(frame);frame=0;
    journalBook?.cancel();
    mount.dataset.renderActive="false";mount.dataset.steamActive="false";
    // Three.js invalidates GPU handles and rebuilds them on restore; keep the
    // CPU-side geometry/material/texture objects alive for that re-upload.
    motion?.resolve();motion=undefined;canvas.hidden=true;onFailure(error);
  }
  function render() {
    if(destroyed||failed)return false;
    try {
      renderer.render(scene,camera);
      if(drawers[0].open&&diary.visible){
        const point=diary.localToWorld(new THREE.Vector3(0,.06,-.12)).project(camera);
        mount.dataset.diaryTarget=`${(point.x+1)*mount.clientWidth/2},${(1-point.y)*mount.clientHeight/2}`;
      }else delete mount.dataset.diaryTarget;
      if(renderer.getContext().isContextLost()) {fail(new StudioFailure("context-lost","WebGL context lost"));return false;}
      if(shaderError)throw shaderError;
    } catch(error) {fail(studioFailure(error,"render"));return false;}
    if(!ready) {ready=true;canvas.hidden=false;onReady();}
    return true;
  }
  function updateClock() {
    const text=clockText(clockDate,showDate);if(text===displayedTime)return;displayedTime=text;
    const ctx=clockImage.getContext("2d")!;
    ctx.fillStyle="#101d1d";ctx.fillRect(0,0,clockImage.width,clockImage.height);ctx.fillStyle="#b5edc7";
    ctx.fillText(text,clockImage.width/2,clockImage.height/2,clockImage.width*0.92);clockTexture.needsUpdate=true;
    deskClock.userData.label=`${text} · 点击显示${showDate?"时间":"日期"}`;
    canvas.setAttribute("aria-label",`工作室场景，电子钟${showDate?"日期":"时间"} ${text}；滚轮缩放，拖动改变视角，Tab 键可访问内容和缩放入口`);requestDraw();
  }
  function surfaceView(surface: THREE.Mesh) {
    surface.updateWorldMatrix(true,false);
    const {width,height}=(surface.geometry as THREE.PlaneGeometry).parameters;
    const scale=surface.getWorldScale(new THREE.Vector3());
    const look=surface.getWorldPosition(new THREE.Vector3());
    const distance=surfaceDistance(width*scale.x,height*scale.y,camera.aspect,camera.fov);
    const position=new THREE.Vector3(0,0,1).transformDirection(surface.matrixWorld).multiplyScalar(distance).add(look);
    return {position,look,rotation:surface.getWorldQuaternion(new THREE.Quaternion())};
  }
  function resize() {
    const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    clearHover();if(!zoomed&&!motion)setRoomCamera();journalBook?.resize();poseJournal();requestDraw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  cleanup.push(()=>resizeObserver.disconnect());
  const gestures = createStudioGestureController({
    canvas, camera, room, mount, tooltip, signal: events.signal,
    canInteract: roomInteractive,
    canPickJournal: () => drawers[0].open && !drawers[0].moving && diary.visible,
    onWheel: (deltaY, deltaMode, height) => changeZoom(wheelZoom(targetZoom, deltaY, deltaMode, height)),
    orbit: (dx, dy) => {
      targetAngle = clampRoomAngle(targetAngle - dx * 0.0025);
      targetElevation = clampRoomElevation(targetElevation + dy * 0.0018);
      requestCamera();
    },
    onAction, requestDraw,
  });
  const clearHover = gestures.clearHover;
  reducedMotion.addEventListener("change",()=>{clearHover();if(reducedMotion.matches) {roomZoom=targetZoom;angle=targetAngle;elevation=targetElevation;stopCamera();}if(!motion&&!zoomed)setRoomCamera();requestDraw();},{signal:events.signal});
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();fail(new StudioFailure("context-lost",(event as WebGLContextEvent).statusMessage||"WebGL context lost"));},{signal:events.signal});
  canvas.addEventListener("webglcontextrestored",()=>{
    if(destroyed)return;
    failed=false;shaderError=undefined;ready=false;steamFrameTime=undefined;chairFrameTime=undefined;
    drawers.forEach(drawer=>drawer.frameTime=undefined);
    textures.forEach(texture=>texture.needsUpdate=true);
    renderer.shadowMap.needsUpdate=true;
    render();if(active)requestDraw();
  },{signal:events.signal});
  setRoomCamera();resize();
  return {
    configureJournal(book:JournalManifest,index:number,onReport:(state:BookReport)=>void,onRegion:(region:JournalRegion)=>void) {
      journalBook??=createJournalBook(renderer,scene,camera,requestDraw);
      journalBook.setInteractionEnabled(journalInteractionEnabled);
      journalBook.configure(book,onReport,onRegion);journalBook.setPage(index);journalBook.resize();
    },
    setJournalInteractionEnabled(value:boolean){journalInteractionEnabled=value;journalBook?.setInteractionEnabled(value);},
    moveJournal(enter:boolean,duration:number) {
      if(!journalBook)return Promise.resolve();
      if(failed||destroyed||!active)duration=0;
      stopCamera();clearHover();motion?.resolve();motion=undefined;zoomed=true;
      const drawer=drawers[0],drawerStart=drawer.group.position.z;
      const drawerEnd=-.68+.85,drawerDuration=Math.abs(drawerStart-drawerEnd)>.001&&duration?420:0;
      drawer.open=true;drawer.moving=false;drawer.to=.85;
      drawer.group.userData.label=ACTION_LABELS['drawer-top'].replace('打开','关闭');
      const total=duration+drawerDuration;
      if(enter){journalActive=false;diary.visible=true;journalBook.activate(false);}
      let transferred=!enter;
      const sample=(value:number)=>{
        const elapsed=value*total,drawerProgress=drawerDuration?Math.min(1,elapsed/drawerDuration):1;
        const drawerZ=THREE.MathUtils.lerp(drawerStart,drawerEnd,smooth(drawerProgress));
        if(drawer.group.position.z!==drawerZ)renderer.shadowMap.needsUpdate=true;
        drawer.group.position.z=drawerZ;
        mount.dataset.journalDrawerReady=String(drawerProgress===1);
        if(drawerProgress<1)return;
        if(!transferred){transferred=true;journalActive=true;diary.visible=false;journalBook!.activate(true);}
        const travel=duration?Math.min(1,(elapsed-drawerDuration)/duration):1;
        journalAmount=enter?travel:1-travel;poseJournal();
      };
      const finish=()=>{
        drawer.group.position.z=drawerEnd;mount.dataset.journalDrawerReady='true';
        if(!enter){journalActive=false;journalAmount=0;diary.visible=true;journalBook?.activate(false);zoomed=false;setRoomCamera();}
        requestDraw();
      };
      if(!total){sample(1);finish();return Promise.resolve();}
      sample(0);
      return new Promise<void>(resolve=>{motion={start:performance.now(),duration:total,sample,enter:true,resolve:()=>{finish();resolve();}};requestDraw();});
    },
    hideJournal() {journalActive=false;journalAmount=0;diary.visible=true;journalBook?.activate(false);zoomed=false;setRoomCamera();requestDraw();},
    prepareJournal(reading:boolean){journalBook?.prepare(reading);},
    journalAvailable(){return !failed&&!destroyed;},
    openJournal(value:boolean){return journalBook?.open(value,reducedMotion.matches||failed||destroyed||!active)??Promise.resolve();},
    resetJournal(){journalBook?.resetView();},
    setJournalPage(index:number){journalBook?.setPage(index);},
    turnJournal(direction:1|-1){journalBook?.turn(direction,reducedMotion.matches);},
    zoomJournal(value:number){journalBook?.setZoom(value);poseJournal();},
    retryJournal(){journalBook?.retry();},
    snapshot() {return {view:{zoom:targetZoom,angle:targetAngle,elevation:targetElevation},lampOn,showDate,drawers:drawers.map(drawer=>drawer.open)};},
    restore(snapshot:{view:RoomView;lampOn:boolean;showDate:boolean;drawers:boolean[]}) {
      roomZoom=targetZoom=snapshot.view.zoom;angle=targetAngle=snapshot.view.angle;elevation=targetElevation=snapshot.view.elevation;
      if(lampOn!==snapshot.lampOn)this.toggleLamp();
      if(showDate!==snapshot.showDate)this.toggleClock();
      drawers.forEach((drawer,index)=>{if(drawer.open!==snapshot.drawers[index])this.toggleDrawer(drawer.action);drawer.moving=false;drawer.group.position.z=-0.68+drawer.to;});
      setRoomCamera();onViewChange(snapshot.view);requestDraw();
    },
    setPointerEnabled(value:boolean) {
      gestures.setPointerEnabled(value);
      if(!value) {
        stopCamera();requestDraw();
      }
    },
    setActive(value:boolean) {const wasActive=active;active=value;mount.dataset.renderActive=String(value&&!failed);if(!value) {journalBook?.cancel();stopCamera();steamFrameTime=undefined;steam.visible=false;mount.dataset.steamActive="false";cancelAnimationFrame(frame);frame=0;chairFrameTime=undefined;drawers.forEach(drawer=>drawer.frameTime=undefined);gestures.reset();if(!zoomed&&!motion)setRoomCamera();if(wasActive&&!failed&&!destroyed)render();}else requestDraw();},
    adjustView(action:RoomViewAction) {
      if(!roomInteractive())return;
      const next=stepRoomView({zoom:targetZoom,angle:targetAngle,elevation:targetElevation},action);
      targetZoom=next.zoom;targetAngle=next.angle;targetElevation=next.elevation;requestCamera();
    },
    toggleDrawer(action:typeof drawerActions[number]) {
      const drawer=drawers.find(drawer=>drawer.action===action)!;
      clearHover();drawer.open=!drawer.open;drawer.from=drawer.group.position.z+0.68;drawer.to=drawer.open?0.85:0;
      drawer.elapsed=0;drawer.frameTime=undefined;drawer.moving=!reducedMotion.matches;
      if(!drawer.moving)drawer.group.position.z=-0.68+drawer.to;
      renderer.shadowMap.needsUpdate=true;
      drawer.group.userData.label=ACTION_LABELS[action].replace("打开",drawer.open?"关闭":"打开");
      requestDraw();return drawer.open;
    },
    toggleLamp() {
      clearHover();lampOn=!lampOn;lamp.intensity=lampOn?lampPower:0;
      diffuserMaterial.emissiveIntensity=lampOn?1.5:0;diffuserMaterial.color.setHex(lampOn?0xffe3aa:0xc7c1b3);
      lampModel.userData.label=lampOn?"关闭台灯":"开启台灯";requestDraw();return lampOn;
    },
    toggleClock() {clearHover();showDate=!showDate;clockDate=new Date();updateClock();return showDate;},
    spinChair(reducedMotion=false) {
      if(failed||destroyed||chairElapsed!==undefined)return;
      if(reducedMotion) {chair.rotation.y=0;requestDraw();return;}
      for(const caster of casters)caster.startAngle=caster.group.rotation.y;
      chairElapsed=0;chairFrameTime=undefined;clearHover();requestDraw();
    },
    setLighting(light:ReturnType<typeof studioLighting>) {
      renderer.shadowMap.needsUpdate=true;
      sun.intensity=1.1+2.1*light.daylight;sun.color.setHex(light.sun);
      ambient.intensity=1.35+1.25*light.daylight;lampPower=2.8*(1-light.daylight)+1.2;lamp.intensity=lampOn?lampPower:0;
      requestDraw();
    },
    setTime(date:Date) {
      clockDate=date;updateClock();
    },
    moveToSurface(target:"computer"|"canvas",enter:boolean,duration:number,update:(progress:number,rect:{left:number;top:number;width:number;height:number})=>void) {
      stopCamera();motion?.resolve();zoomed=enter;
      clearHover();
      const surface=target==="computer"?computerSurface:canvasSurface;
      const view=surfaceView(surface);
      const from=enter?camera.position.clone():roomPosition();
      const roomCamera=camera.clone();roomCamera.position.copy(from);roomCamera.lookAt(enter?currentLook:roomLook());
      const via=new THREE.Vector3(0,0,1).applyQuaternion(view.rotation).multiplyScalar(Math.max(2.5,from.distanceTo(view.look)*0.65)).add(view.look);
      const {width,height}=(surface.geometry as THREE.PlaneGeometry).parameters;
      const sample=(progress:number)=>{
        // A resize during return must land on the new viewport's room framing.
        if(!enter) {from.copy(roomPosition());roomCamera.position.copy(from);roomCamera.lookAt(roomLook());}
        const {align,approach}=surfacePhases(progress);
        camera.position.lerpVectors(from,via,align).lerp(view.position,approach);
        camera.quaternion.slerpQuaternions(roomCamera.quaternion,view.rotation,align);
        currentLook.copy(progress===0?roomLook():view.look);camera.updateMatrixWorld();
        const a=new THREE.Vector3(-width/2,height/2,0).applyMatrix4(surface.matrixWorld).project(camera);
        const b=new THREE.Vector3(width/2,-height/2,0).applyMatrix4(surface.matrixWorld).project(camera);
        const bounds=mount.getBoundingClientRect();
        update(progress,{left:bounds.left+(a.x+1)*bounds.width/2,top:bounds.top+(1-a.y)*bounds.height/2,width:(b.x-a.x)*bounds.width/2,height:(a.y-b.y)*bounds.height/2});
      };
      if(!duration||failed) {sample(enter?1:0);requestDraw();return Promise.resolve();}
      sample(enter?0:1);
      return new Promise<void>(resolve=>{motion={start:performance.now(),duration,sample,enter,resolve};requestDraw();});
    },
    cancelTransition() {stopCamera();clearHover();journalBook?.cancel();motion?.resolve();motion=undefined;zoomed=journalActive;setRoomCamera();requestDraw();},
    dispose() {if(destroyed)return;destroyed=true;mount.dataset.renderActive="false";mount.dataset.steamActive="false";clearHover();motion?.resolve();cleanup.reverse().forEach(dispose=>dispose());},
  };
  } catch(error) {
    cleanup.reverse().forEach(dispose=>dispose());
    throw studioFailure(error,"initialization");
  }
}
