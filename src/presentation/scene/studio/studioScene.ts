import * as THREE from "three";
import { createStudioObjects } from "./studioObjects";
import { workspaceAppearance } from "../../../config/workspaceAppearance";
import { createChairRocking } from "../../../animation/studio/chairMotion";
import { breezeAt } from '../../../animation/studio/breeze.ts';
import { ACTION_LABELS, type StudioAction } from "../../../contracts/studio";
import { smooth, surfaceDistance, surfacePhases, surfaceFlight, wheelZoom, clampRoomZoom, clampRoomAngle, clampRoomElevation, roomCameraStep, DEFAULT_ROOM_VIEW, ROOM_ZOOM_MAX, CAMERA_ZOOM_OMEGA } from "../../../animation/studio/studioMotion";
import { clockText, studioLighting } from "../../../config/studioTime";
import { stepRoomView, type RoomView, type RoomViewAction } from "../../../animation/studio/studioMotion";
import { StudioFailure, studioFailure } from "../../../contracts/studioFailure";
import type { StudioSceneFile } from "../../../contracts/studio";
import type { StudioLighting, EntranceTransition, SurfaceRect } from "../../../contracts/studioPorts";
import { createJournalBook } from "../journal/journalBook";
import { createActiveMotion } from "../../../animation/activeMotion";
import type { OperationResult } from "../../../contracts/operation";
import type { JournalManifest, JournalRegion, BookReport, JournalIntent } from "../../../contracts/journal";
import { createStudioGestureController } from "../../interaction/studio/sceneGestures";
import { createZoomPicker } from '../../interaction/studio/zoomPicking.ts';
import { createStudioBounds } from "../../interaction/studio/sceneBounds";
import { disposeSafely } from "../../../infrastructure/client/dispose";
import { createIslandEnvironment } from "./islandEnvironment";
import { deviceSurfaceSize } from './deviceGeometry.ts';
import { islandViewDistance, islandEntranceDistance } from "../../../animation/studio/islandFraming";
import { entrancePose, entranceBlend, entranceContentProgress, ENTRANCE_AZIMUTH, ENTRANCE_PITCH, ENTRANCE_OCCUPANCY } from '../../../animation/studio/entranceMotion';
import { islandAppearance } from "../../../config/islandAppearance";
import { acceptsIslandFocus,clampIslandFocus } from '../../../animation/studio/islandNavigation.ts';
import { createScenePerformanceOverlay, type SceneDebugGroup } from './scenePerformanceOverlay.ts';
import type { StartupProgress } from '../../../contracts/startup.ts';
import type { PreparedSceneGeometry } from './sceneGeometryData.ts';
import { paintOpportunity } from '../../../infrastructure/client/paintOpportunity.ts';
import { waitForOptionalResource } from '../../../infrastructure/client/optionalResource.ts';
export { prepareSceneGeometry } from './prepareSceneGeometry.ts';
export { disposePreparedGeometry } from './sceneGeometryData.ts';

export type StudioScene = Awaited<ReturnType<typeof createStudioScene>>;

export async function createStudioScene(mount: HTMLElement, onAction: (action: StudioAction) => void, onFailure: (error:StudioFailure) => void, onViewChange: (view:RoomView)=>void = ()=>{}, onReady:()=>void = ()=>{}, lightweight=false, studioFiles: readonly StudioSceneFile[] = [], computerLabel = "", preparation?:{geometry:Promise<PreparedSceneGeometry>;signal:AbortSignal;timings:Record<string,number>}) {
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
  cleanup.push(()=>disposeSafely([()=>renderer.dispose(),()=>{if(!renderer.getContext().isContextLost())renderer.forceContextLoss();},()=>canvas.remove()]));
  try {
  renderer.setPixelRatio(Math.min(devicePixelRatio, lightweight?1:1.5));
  const initialRenderRatio=renderer.getPixelRatio();
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
  const threeDevtools=(window as Window&{__THREE_DEVTOOLS__?:EventTarget}).__THREE_DEVTOOLS__;
  if(threeDevtools instanceof EventTarget){
    threeDevtools.dispatchEvent(new CustomEvent('observe',{detail:renderer}));
    threeDevtools.dispatchEvent(new CustomEvent('observe',{detail:scene}));
  }
  const room = new THREE.Group(); scene.add(room);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
  const focus = new THREE.Vector3(0, 0.35, islandAppearance.centerZ);
  const events = new AbortController();
  const bounds = createStudioBounds(mount, canvas, events.signal);
  cleanup.push(()=>events.abort());
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const releaseResources=()=>disposeSafely([...geometries,...materials,...textures].map(resource=>()=>resource.dispose()));
  cleanup.push(releaseResources);
  const debugAxes=new THREE.AxesHelper(3);
  debugAxes.position.copy(focus);debugAxes.visible=false;scene.add(debugAxes);
  geometries.add(debugAxes.geometry);
  (Array.isArray(debugAxes.material)?debugAxes.material:[debugAxes.material]).forEach(material=>materials.add(material));
  let debugWireframe=false,debugTimeHour:number|null=null;
  const originalWireframe=new Map<THREE.Material,boolean>();
  const tooltip = mount.querySelector<HTMLElement>("[data-studio-tooltip]")!;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // The shell activates only after prepareStartup. Starting active would make
  // setActive(false) submit an unheated full render before compileAsync.
  let active = false;
  let destroyed = false;
  let failed = false;
  let frame = 0;
  let processingInput = false, drawRequested = true;
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
  let inputFrameTime: number | undefined;
  let previousDrawTime: number | undefined;
  let performanceOverlay:ReturnType<typeof createScenePerformanceOverlay>|undefined;
  const cameraSpeed={zoom:{velocity:0},angle:{velocity:0},elevation:{velocity:0},x:{velocity:0},y:{velocity:0},z:{velocity:0}};
  const cameraStates=Object.values(cameraSpeed);
  const focusOffset=new THREE.Vector3(),targetOffset=new THREE.Vector3();
  function viewSnapshot():RoomView{return {zoom:targetZoom,angle:targetAngle,elevation:targetElevation,focusOffset:{x:targetOffset.x,y:targetOffset.y,z:targetOffset.z}};}
  function resetCameraSpeed(){for(const state of cameraStates)state.velocity=0;}
  let zoomed = false;
  const motion = createActiveMotion();
  let entranceProgress: number | undefined;
  let entranceFlight=false;
  let entranceUpdate:((progress:number)=>void)|undefined;
  const entranceCamera=camera.clone(),contentCamera=camera.clone();
  let startupVersion = 0;
  let startupAbort:AbortController|undefined;
  cleanup.push(()=>startupAbort?.abort());
  const chairRocking = createChairRocking();
  let chairFrameTime: number | undefined;
  const currentLook = focus.clone();
  const furnitureStarted=performance.now();
  const {
    canopy,dressing,leisure,fileLibrary,
    drawerActions, drawers, diary, computerSurface, canvasSurface,
    chairSeat, steam, deskClock, clockImage, clockTexture,
    lampModel, diffuserMaterial, lamp, sun, ambient, screenGlow, tabletGlow,
  } = createStudioObjects({ renderer, scene, room, studioFiles, computerLabel, materials, geometries, textures, cleanup });
  if(preparation)preparation.timings.furnitureCpu=performance.now()-furnitureStarted;
  const prepared=await preparation?.geometry;
  if(prepared)for(const geometry of [prepared.sand,prepared.water,prepared.rocks,prepared.vegetation.trunkGeometry,prepared.vegetation.stemGeometry,...prepared.vegetation.details.flatMap(levels=>levels.map(l=>l.geometry))])geometries.add(geometry);
  if(preparation?.signal.aborted)throw new DOMException('Preparation cancelled','AbortError');
  const assemblyStarted=performance.now();
  const environment = createIslandEnvironment(scene, materials, geometries, prepared);
  cleanup.push(()=>scene.remove(environment.group));
  let settleNormals: () => void;
  const normalsReady = new Promise<void>(resolve => { settleNormals = resolve; });
  const oceanNormals = new THREE.TextureLoader().load(
    new URL("../../../content/scene/waternormals.jpg", import.meta.url).href,
    texture=>{if(!destroyed){environment.setNormals(texture);requestDraw();}else texture.dispose();settleNormals();},
    undefined,()=>{settleNormals(); /* Analytic swells are the existing detail-texture fallback. */ },
  );
  oceanNormals.wrapS=oceanNormals.wrapT=THREE.RepeatWrapping;
  oceanNormals.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  textures.add(oceanNormals);

  let steamElapsed=0,steamFrameTime:number|undefined;
  let breezeTime=0,breezeFrameTime:number|undefined;
  sun.shadow.autoUpdate=false;lamp.shadow.autoUpdate=false;
  sun.shadow.needsUpdate=lamp.shadow.needsUpdate=true;
  function invalidateShadows(sunOnly=false) {
    renderer.shadowMap.needsUpdate=true;
    sun.shadow.needsUpdate=true;
    if(!sunOnly&&lamp.intensity>0)lamp.shadow.needsUpdate=true;
  }
  let displayedTime="";
  let clockDate=new Date(),showDate=false;
  let lampOn=true,lampPower=2;
  let lastLighting: StudioLighting | undefined,actualLighting:StudioLighting|undefined;

  let journalBook:ReturnType<typeof createJournalBook>|undefined;
  let journalInteractionEnabled = true;
  let journalAmount=0,journalActive=false;
  const diaryRotation=new THREE.Quaternion(),diaryOrigin=new THREE.Vector3();
  const journalHomePosition=new THREE.Vector3(),journalHomeLook=new THREE.Vector3(),journalCameraPosition=new THREE.Vector3(),journalLook=new THREE.Vector3();
  const journalUp=new THREE.Vector3();
  function showDiary(value:boolean) {
    if(diary.visible===value)return;
    diary.visible=value;invalidateShadows();
  }
  function poseJournal() {
    if(!journalBook||!journalActive)return;
    diary.getWorldPosition(diaryOrigin);diary.getWorldQuaternion(diaryRotation);
    diaryRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
    journalBook.pose(journalAmount,diaryOrigin,diaryRotation);
    journalBook.readingView(journalCameraPosition,journalLook);
    camera.position.lerpVectors(journalHomePosition,journalCameraPosition,smooth(journalAmount));
    currentLook.lerpVectors(journalHomeLook,journalLook,smooth(journalAmount));
    journalUp.set(0,1,0).applyQuaternion(diaryRotation);
    camera.up.set(0,1,0).lerp(journalUp,smooth(journalAmount)).normalize();camera.lookAt(currentLook);
    if(entranceFlight)blendEntranceCamera();
  }
  cleanup.push(()=>journalBook?.dispose());

  function roomPosition() {
    const rect=bounds.mount(),aspect=Math.max(0.3,rect.width/Math.max(1,rect.height));
    const overview=islandViewDistance(aspect,angle,elevation,camera.fov);
    const close=Math.max(8.5,8.5/aspect)/ROOM_ZOOM_MAX;
    const t=THREE.MathUtils.clamp((roomZoom-1)/(ROOM_ZOOM_MAX-1),0,1);
    const distance=roomZoom<1?overview/roomZoom:overview*Math.pow(close/overview,t);
    return new THREE.Vector3(Math.sin(angle)*distance,Math.sin(elevation)*distance,Math.cos(angle)*distance).add(roomLook());
  }
  function baseLook(zoom:number) {return focus.clone().lerp(new THREE.Vector3(-0.1,1.43,-1.25),smooth((zoom-1)/(ROOM_ZOOM_MAX-1)));}
  function roomLook() {return baseLook(roomZoom).add(focusOffset);}
  function constrainOffset() {
    const base=baseLook(targetZoom),point=clampIslandFocus(base.clone().add(targetOffset));
    targetOffset.set(point.x-base.x,point.y-base.y,point.z-base.z);
  }
  function roomInteractive() {return entranceProgress===undefined&&active&&!failed&&!destroyed&&!motion.running&&!zoomed&&!mount.closest<HTMLElement>("[data-studio]")?.inert;}
  function setRoomCamera() {camera.up.set(0,1,0);camera.position.copy(roomPosition());currentLook.copy(roomLook());camera.lookAt(currentLook);mount.dataset.cameraZoom=roomZoom.toFixed(4);mount.dataset.cameraAngle=angle.toFixed(4);mount.dataset.cameraElevation=elevation.toFixed(4);}
  function poseEntrance(progress: number) {
    entranceProgress = progress;
    const distance = islandEntranceDistance(camera.aspect, ENTRANCE_AZIMUTH, ENTRANCE_PITCH, ENTRANCE_OCCUPANCY, camera.fov);
    camera.position.fromArray(entrancePose(reducedMotion.matches ? 1 : progress, distance, roomPosition().toArray(), roomLook().toArray()));
    camera.up.set(0,1,0);currentLook.copy(roomLook());camera.lookAt(currentLook);
    mount.dataset.entranceProgress = String(progress);
  }
  function blendEntranceCamera() {
    const progress=entranceProgress??0, blend=reducedMotion.matches?1:entranceBlend(progress);
    contentCamera.position.copy(camera.position);contentCamera.quaternion.copy(camera.quaternion);
    const destinationLook=currentLook.clone();
    poseEntrance(Math.min(1,progress/.72));
    entranceProgress=progress;mount.dataset.entranceProgress=String(progress);
    entranceCamera.position.copy(camera.position);entranceCamera.quaternion.copy(camera.quaternion);
    camera.position.lerpVectors(entranceCamera.position,contentCamera.position,blend);
    camera.quaternion.slerpQuaternions(entranceCamera.quaternion,contentCamera.quaternion,blend);
    currentLook.lerp(destinationLook,blend);camera.updateMatrixWorld();
  }
  function finishEntrance() {
    entranceFlight=false;entranceUpdate=undefined;entranceProgress=undefined;delete mount.dataset.entranceProgress;
    roomZoom=targetZoom;angle=targetAngle;elevation=targetElevation;focusOffset.copy(targetOffset);resetCameraSpeed();
  }
  function cameraMoving() {return angle!==targetAngle||elevation!==targetElevation||roomZoom!==targetZoom||!focusOffset.equals(targetOffset)||cameraStates.some(state=>state.velocity!==0);}
  function stopCamera() {cameraFrameTime=undefined;resetCameraSpeed();targetZoom=roomZoom;targetAngle=angle;targetElevation=elevation;targetOffset.copy(focusOffset);onViewChange(viewSnapshot());}
  function requestCamera() {
    clearHover();
    performanceOverlay?.recordInput(performance.now());
    onViewChange(viewSnapshot());
    if(reducedMotion.matches) {resetCameraSpeed();roomZoom=targetZoom;angle=targetAngle;elevation=targetElevation;focusOffset.copy(targetOffset);setRoomCamera();}
    cameraFrameTime??=inputFrameTime??performance.now();requestDraw();
  }
  function changeZoom(value:number,anchor?:THREE.Vector3) {
    const old=targetZoom;targetZoom=clampRoomZoom(value);
    if(targetZoom>old&&anchor){
      const center=baseLook(targetZoom).add(targetOffset);
      targetOffset.addScaledVector(anchor.clone().sub(center),Math.min(1,(targetZoom-old)*2));
    }else if(targetZoom<old)targetOffset.multiplyScalar(Math.max(0,targetZoom-1)/Math.max(.0001,old-1));
    constrainOffset();requestCamera();
  }
  function draw(now:number) {
    frame=0;
    if(!active||destroyed||failed) return;
    const updateStart=performance.now();
    inputFrameTime=previousDrawTime??now-1000/60;previousDrawTime=now;
    processingInput=true;
    try { gestures.flushMove(); } finally { processingInput=false;inputFrameTime=undefined; }
    const cameraChanged=entranceProgress===undefined&&cameraMoving()&&!motion.running&&!zoomed;
    const objectsChanged=chairRocking.moving||drawers.some(drawer=>drawer.moving);
    if(cameraChanged) {
      const elapsed=cameraFrameTime===undefined?0:now-cameraFrameTime;cameraFrameTime=now;
      for(const axis of ['x','y','z'] as const)focusOffset[axis]=roomCameraStep(focusOffset[axis],targetOffset[axis],elapsed,cameraSpeed[axis]);
      const zoom=roomCameraStep(roomZoom,targetZoom,elapsed,cameraSpeed.zoom,CAMERA_ZOOM_OMEGA),height=roomCameraStep(elevation,targetElevation,elapsed,cameraSpeed.elevation);
      roomZoom=clampRoomZoom(zoom);elevation=clampRoomElevation(height);
      if(zoom!==roomZoom)cameraSpeed.zoom.velocity=0;if(height!==elevation)cameraSpeed.elevation.velocity=0;
      angle=roomCameraStep(angle,targetAngle,elapsed,cameraSpeed.angle);setRoomCamera();
    } else cameraFrameTime=undefined;
    const steamOpacity=THREE.MathUtils.smoothstep(lastLighting?.daylight??0,0.2,0.65);
    const steamActive=roomInteractive()&&!reducedMotion.matches&&steamOpacity>0;
    steam.visible=steamActive;mount.dataset.steamActive=String(steamActive);
    if(steamActive) {
      steamElapsed+=steamFrameTime===undefined?0:Math.min(50,now-steamFrameTime);steamFrameTime=now;
      steam.children.forEach((object,index)=>{
        const puff=object as THREE.Sprite,t=(steamElapsed/3200+index/steam.children.length)%1;
        const drift=breezeAt(-1.1,-.94,breezeTime)*t*t*.065;
        puff.position.set(Math.sin(t*7+index)*0.035*t+drift*.85,0.19+t*0.34,Math.cos(t*5+index)*0.025*t+drift*.53);
        puff.scale.set(0.025+t*0.085,0.065+t*0.18,1);
        puff.material.opacity=Math.sin(t*Math.PI)*0.42*steamOpacity;
        puff.material.rotation=Math.sin(t*4+index)*0.3;
      });
    } else steamFrameTime=undefined;
    // Steam never changes shadows; only moving solid objects need a fresh map.
    if(objectsChanged)invalidateShadows();
    for(const drawer of drawers) {
      if(!drawer.moving) continue;
      drawer.elapsed+=drawer.frameTime===undefined?0:now-drawer.frameTime;drawer.frameTime=now;
      const t=reducedMotion.matches?1:Math.min(1,drawer.elapsed/420);
      drawer.group.position.z=workspaceAppearance.drawerFront+THREE.MathUtils.lerp(drawer.from,drawer.to,smooth(t));
      if(t===1) {drawer.moving=false;drawer.frameTime=undefined;}
    }
    if(chairRocking.moving) {
      if(reducedMotion.matches)chairRocking.reset();
      const turn=chairRocking.step(chairFrameTime===undefined?0:(now-chairFrameTime)/1000);
      chairFrameTime=now;
      chairSeat.rotation.x=turn.angle;
      chairSeat.position.set(0,turn.y,turn.z);
      if(!chairRocking.moving)chairFrameTime=undefined;
    }
    const transitionChanged=motion.running;
    motion.tick(now);
    const breezeActive=!lightweight&&!reducedMotion.matches&&(!zoomed||motion.running)&&!(journalActive&&journalAmount===1);
    if(breezeActive){breezeTime+=breezeFrameTime===undefined?0:Math.min(50,Math.max(0,now-breezeFrameTime))/1000;breezeFrameTime=now;}
    else breezeFrameTime=undefined;
    environment.setWind(breezeTime);dressing.setWind(breezeTime);leisure.setWind(breezeTime);
    const canopyState=canopy.update(now,camera.position,currentLook,reducedMotion.matches,breezeTime,breezeActive,entranceProgress===undefined&&(motion.running||zoomed));
    // The roof is above the downward task-light cone; it only casts into the sun map.
    if(canopyState.shadowChanged)invalidateShadows(true);
    // The broad task-light cone can also reach understory near the desk.
    // Keep those moving shadows current; a roof fade alone need not refresh it.
    if(breezeActive)invalidateShadows();
    const journalMoving=journalBook?.tick(now);
    if(journalMoving)invalidateShadows();
    poseJournal();
    const oceanMoving=environment.tick(now,!lightweight&&!reducedMotion.matches&&(!zoomed||motion.running)&&!(journalActive&&journalAmount===1));
    leisure.setWaterTime(environment.time);
    environment.setBoatInverse(leisure.boatInverse);
    mount.dataset.oceanActive=String(oceanMoving);
    const paint=drawRequested||cameraChanged||objectsChanged||steamActive||oceanMoving||transitionChanged||journalMoving||canopyState.changed;
    drawRequested=false;
    if(paint&&!render(now,performance.now()-updateStart))return;
    if(active&&!frame&&(motion.running||journalMoving||cameraMoving()||steamActive||oceanMoving||canopyState.moving||chairRocking.moving||drawers.some(drawer=>drawer.moving))) frame=requestAnimationFrame(draw);
  }
  function requestInputFrame() {if(!processingInput&&active&&!frame&&!destroyed&&!failed) frame=requestAnimationFrame(draw);}
  function requestDraw() {drawRequested=true;requestInputFrame();}
  function fail(error:StudioFailure) {
    if(destroyed||failed)return;
    failed=true;ready=false;clearHover();cancelAnimationFrame(frame);frame=0;
    journalBook?.cancel();
    mount.dataset.renderActive="false";mount.dataset.steamActive="false";
    environment.pause();mount.dataset.oceanActive="false";
    // Three.js invalidates GPU handles and rebuilds them on restore; keep the
    // CPU-side geometry/material/texture objects alive for that re-upload.
    motion.cancel("scene-failed");canvas.hidden=true;onFailure(error);
  }
  function render(frameTime=performance.now(),updateCpuMs=0) {
    if(destroyed||failed)return false;
    let renderSubmissionMs=0,shadowRefresh=false;
    try {
      if(environment.updateDetail(camera,canvas.height))invalidateShadows();
      shadowRefresh=renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate;
      const renderStart=performance.now();
      renderer.render(scene,camera);
      renderSubmissionMs=performance.now()-renderStart;
      if(diary.visible){
        const point=diary.localToWorld(new THREE.Vector3(0,.06,-.12)).project(camera);
        const rect=bounds.mount();mount.dataset.diaryTarget=`${(point.x+1)*rect.width/2},${(1-point.y)*rect.height/2}`;
      }else delete mount.dataset.diaryTarget;
      if(renderer.getContext().isContextLost()) {fail(new StudioFailure("context-lost","WebGL context lost"));return false;}
      if(shaderError)throw shaderError;
      journalBook?.afterRender();
    } catch(error) {fail(studioFailure(error,"render"));return false;}
    if(!ready) {ready=true;canvas.hidden=false;onReady();}
    performanceOverlay?.record(frameTime,renderSubmissionMs,updateCpuMs,renderer.info.render.calls,renderer.info.render.triangles,shadowRefresh);
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
  function debugClockDate(hour:number) {
    const date=new Date(),minutes=Math.round(hour*60);
    date.setHours(Math.floor(minutes/60),minutes%60,0,0);return date;
  }
  function applyLighting(light:StudioLighting) {
    dressing.setLighting(light.daylight);leisure.setLighting(light.daylight);
    if(lastLighting&&JSON.stringify(lastLighting)===JSON.stringify(light))return;
    const sunMoved=!lastLighting||lastLighting.sunDirection.some((v,i)=>v!==light.sunDirection[i])||lastLighting.moonDirection.some((v,i)=>v!==light.moonDirection[i]);
    lastLighting=light;environment.setLighting(light);
    const moonlight=light.sunIntensity<light.moonIntensity;
    sun.intensity=moonlight?light.moonIntensity:light.sunIntensity;sun.color.setHex(moonlight?0xa6bbeb:light.sun);
    sun.position.fromArray(moonlight?light.moonDirection:light.sunDirection).multiplyScalar(35).add(sun.target.position);
    if(sunMoved)invalidateShadows(true);
    ambient.intensity=light.ambientIntensity;ambient.color.setHex(light.sky);
    lampPower=light.lampIntensity;lamp.intensity=lampOn?lampPower:0;
    screenGlow.intensity=tabletGlow.intensity=light.screenSpillIntensity;requestDraw();
  }
  function setDebugTime(hour:number|null) {
    debugTimeHour=hour===null?null:Math.max(0,Math.min(23.75,hour));
    const date=debugTimeHour===null?new Date():debugClockDate(debugTimeHour);
    clockDate=date;updateClock();
    const light=debugTimeHour===null?actualLighting:studioLighting(date);
    if(light)applyLighting(light);
  }
  function setDebugGroupVisible(group:SceneDebugGroup,visible:boolean) {
    const targets:{[K in SceneDebugGroup]:THREE.Group}={workspace:room,canopy:canopy.group,dressing:dressing.group,leisure:leisure.group,environment:environment.group};
    targets[group].visible=visible;requestDraw();
  }
  function setDebugWireframe(enabled:boolean) {
    debugWireframe=enabled;
    scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const list=Array.isArray(object.material)?object.material:[object.material];
      for(const material of list){
        const wireMaterial=material as THREE.Material&{wireframe?:boolean};
        if(typeof wireMaterial.wireframe!=='boolean')continue;
        if(!originalWireframe.has(material))originalWireframe.set(material,wireMaterial.wireframe);
        wireMaterial.wireframe=enabled?true:originalWireframe.get(material)!;material.needsUpdate=true;
      }
    });requestDraw();
  }
  function setDebugShadows(enabled:boolean) {
    renderer.shadowMap.enabled=enabled;
    if(enabled)invalidateShadows();
    requestDraw();
  }
  function setDebugRenderRatio(value:number) {
    renderer.setPixelRatio(Math.max(.5,Math.min(2,value)));resize();requestDraw();
  }
  function setDebugView(view:{zoom:number;angle:number;elevation:number}) {
    if(!active||failed||destroyed||motion.running||zoomed||journalActive||entranceProgress!==undefined)return;
    targetZoom=clampRoomZoom(view.zoom);targetAngle=clampRoomAngle(view.angle);targetElevation=clampRoomElevation(view.elevation);requestCamera();
  }
  function resetDebugView() {
    if(!active||failed||destroyed||motion.running||zoomed||journalActive||entranceProgress!==undefined)return;
    targetOffset.set(0,0,0);targetZoom=DEFAULT_ROOM_VIEW.zoom;targetAngle=DEFAULT_ROOM_VIEW.angle;targetElevation=DEFAULT_ROOM_VIEW.elevation;requestCamera();
  }
  function surfaceView(surface: THREE.Mesh) {
    surface.updateWorldMatrix(true,false);
    const {width,height}=deviceSurfaceSize(surface.geometry);
    const scale=surface.getWorldScale(new THREE.Vector3());
    const look=surface.getWorldPosition(new THREE.Vector3());
    const distance=surfaceDistance(width*scale.x,height*scale.y,camera.aspect,camera.fov);
    const position=new THREE.Vector3(0,0,1).transformDirection(surface.matrixWorld).multiplyScalar(distance).add(look);
    return {position,look,rotation:surface.getWorldQuaternion(new THREE.Quaternion())};
  }
  function resize() {
    bounds.invalidate();
    const {width:w,height:h}=bounds.mount();if(!w||!h)return;
    renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    clearHover();if(entranceProgress!==undefined)poseEntrance(entranceProgress);else if(!zoomed&&!motion.running)setRoomCamera();journalBook?.resize();poseJournal();requestDraw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  cleanup.push(()=>resizeObserver.disconnect());
  const zoomRay=new THREE.Raycaster(),zoomPointer=new THREE.Vector2();
  const zoomCandidates:THREE.Object3D[]=[];
  for(const root of [room,dressing.group,leisure.group,environment.group])root.traverse(object=>{
    if(object instanceof THREE.Mesh&&!object.userData.hitProxy&&object.name!=='island-water'&&object.name!=='island-sky'&&!(object.material instanceof THREE.ShaderMaterial))zoomCandidates.push(object);
  });
  const zoomPicker=createZoomPicker(zoomCandidates);
  cleanup.push(()=>zoomPicker.dispose());
  let zoomAnchor:THREE.Vector3|undefined,anchorTime=-Infinity,anchorX=0,anchorY=0;
  function anchorAt(x:number,y:number) {
    const now=performance.now();
    if(now-anchorTime<180&&Math.hypot(x-anchorX,y-anchorY)<14){anchorTime=now;return zoomAnchor;}
    anchorTime=now;anchorX=x;anchorY=y;zoomAnchor=undefined;
    const rect=bounds.canvas();if(!rect.width||!rect.height)return;
    zoomPointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
    camera.updateMatrixWorld();scene.updateMatrixWorld(true);zoomRay.setFromCamera(zoomPointer,camera);
    const hit=zoomPicker.intersect(zoomRay);
    if(hit&&acceptsIslandFocus(hit.point)){const point=clampIslandFocus(hit.point);zoomAnchor=new THREE.Vector3(point.x,point.y,point.z);}
    return zoomAnchor;
  }
  const gestures = createStudioGestureController({
    canvas, camera, room, mount, tooltip, signal: events.signal, bounds,
    canInteract: roomInteractive,
    canPickJournal: () => diary.visible,
    onWheel: (deltaY, deltaMode, height,x,y) => changeZoom(wheelZoom(targetZoom, deltaY, deltaMode, height),deltaY<0?anchorAt(x,y):undefined),
    orbit: (dx, dy) => {
      anchorTime=-Infinity;
      targetAngle = clampRoomAngle(targetAngle - dx * 0.0025);
      targetElevation = clampRoomElevation(targetElevation + dy * 0.0018);
      requestCamera();
    },
    onAction, requestDraw, requestInputFrame,
  });
  const clearHover = gestures.clearHover;
  reducedMotion.addEventListener("change",()=>{clearHover();if(reducedMotion.matches) {roomZoom=targetZoom;angle=targetAngle;elevation=targetElevation;focusOffset.copy(targetOffset);stopCamera();}if(entranceProgress!==undefined)poseEntrance(entranceProgress);else if(!motion.running&&!zoomed)setRoomCamera();requestDraw();},{signal:events.signal});
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();fail(new StudioFailure("context-lost",(event as WebGLContextEvent).statusMessage||"WebGL context lost"));},{signal:events.signal});
  canvas.addEventListener("webglcontextrestored",()=>{
    if(destroyed)return;
    failed=false;shaderError=undefined;ready=false;steamFrameTime=undefined;chairFrameTime=undefined;
    drawers.forEach(drawer=>drawer.frameTime=undefined);
    textures.forEach(texture=>texture.needsUpdate=true);
    invalidateShadows();
    render();if(active)requestDraw();
  },{signal:events.signal});
  setRoomCamera();resize();
  performanceOverlay=createScenePerformanceOverlay({canvas,renderer,scene,camera,details:()=>({
    active:active&&!failed&&!destroyed,zoom:targetZoom,angle:targetAngle,elevation:targetElevation,
    camera:[camera.position.x,camera.position.y,camera.position.z],
    ocean:mount.dataset.oceanActive==='true',steam:mount.dataset.steamActive==='true',
    lightweight,reducedMotion:reducedMotion.matches,journal:journalActive,transition:motion.running||entranceProgress!==undefined,
    axes:debugAxes.visible,wireframe:debugWireframe,renderRatio:renderer.getPixelRatio(),debugTimeHour,
    groups:{workspace:room.visible,canopy:canopy.group.visible,dressing:dressing.group.visible,leisure:leisure.group.visible,environment:environment.group.visible},
  }),controls:{
    setView:setDebugView,resetView:resetDebugView,setGroupVisible:setDebugGroupVisible,
    setAxes(value){debugAxes.visible=value;requestDraw();},setWireframe:setDebugWireframe,
    setShadows:setDebugShadows,setRenderRatio:setDebugRenderRatio,resetRenderRatio:()=>setDebugRenderRatio(initialRenderRatio),setDebugTime,
  }});
  cleanup.push(()=>performanceOverlay?.dispose());
  if(preparation)preparation.timings.assemblyCpu=performance.now()-assemblyStarted;
  return {
    async prepareStartup({ entrance, onProgress }: { entrance: boolean; onProgress: (progress: StartupProgress) => void }): Promise<OperationResult> {
      const token = ++startupVersion;
      startupAbort?.abort();const abort=startupAbort=new AbortController();
      const valid = () => token === startupVersion && !destroyed && !failed;
      this.setActive(false);stopCamera();
      if(entrance)poseEntrance(0);
      const timings:Record<string,number>=JSON.parse(mount.dataset.startupTimings??'{}');
      const measure=(name:string,start:number)=>{timings[name]=Math.round(performance.now()-start);mount.dataset.startupTimings=JSON.stringify(timings);};
      try {
        onProgress({stage:'texture',progress:2/5});
        await paintOpportunity(abort.signal);
        const normalsStarted=performance.now();
        const normalsResult=await waitForOptionalResource(normalsReady,abort.signal);
        measure('textureWait',normalsStarted);mount.dataset.normalsWait=normalsResult;
        if(!valid())return {status:'cancelled',reason:'startup-replaced'};
        const uploadStarted=performance.now();
        for(const texture of textures) { if(texture.image)renderer.initTexture(texture); }
        measure('textureUpload',uploadStarted);
        onProgress({stage:'shader',progress:3/5});
        await paintOpportunity(abort.signal);
        const compileStarted=performance.now();
        await renderer.compileAsync(scene,camera);
        measure('shaderWarmup',compileStarted);
        if(!valid())return {status:'cancelled',reason:'startup-replaced'};
        onProgress({stage:'first-frame',progress:4/5});
        await paintOpportunity(abort.signal);
        const drawStarted=performance.now();
        // Warm actual draws, including shadows and both canopy/LOD viewpoints.
        setRoomCamera();canopy.update(performance.now(),camera.position,currentLook,true,breezeTime,false,false);
        if(!render())return {status:'failed',code:'startup-render',retryable:true};
        if(entrance)poseEntrance(0);
        canopy.update(performance.now(),camera.position,currentLook,true,breezeTime,false,false);invalidateShadows();
        if(!render())return {status:'failed',code:'startup-render',retryable:true};
        if(!valid())return {status:'cancelled',reason:'startup-replaced'};
        measure('firstDraws',drawStarted);
        onProgress({stage:'ready',progress:1});
        return {status:'completed',value:undefined};
      } catch(error) {if(!valid()||abort.signal.aborted)return {status:'cancelled',reason:'startup-replaced'};fail(studioFailure(error,'render'));return {status:'failed',code:'startup',retryable:true};}
    },
    async playEntrance({duration,onProgress,target,onSurfaceProgress}: EntranceTransition & {target?:'computer'|'canvas'|'works';onSurfaceProgress?:(progress:number,rect:SurfaceRect)=>void}): Promise<OperationResult> {
      if(failed||destroyed)return {status:'failed',code:'entrance-unavailable',retryable:true};
      stopCamera();clearHover();zoomed=false;
      entranceFlight=Boolean(target);entranceUpdate=onProgress;
      const task=target==='works'?motion.start(duration,progress=>{
        entranceProgress=progress;onProgress(progress);
        const look=fileLibrary.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.4,0));
        const position=look.clone().add(new THREE.Vector3(-1.1,2.3,3.5));
        const amount=smooth(entranceContentProgress(progress));
        camera.position.lerpVectors(roomPosition(),position,amount);currentLook.lerpVectors(roomLook(),look,amount);
        camera.up.set(0,1,0);camera.lookAt(currentLook);blendEntranceCamera();
      }):target?this.moveToSurface(target,true,duration,onSurfaceProgress??(()=>{})):
        motion.start(duration,progress=>{poseEntrance(progress);onProgress(progress);});
      requestDraw();const result=await task;
      if(result.status==='completed'&&!destroyed&&!failed) {
        finishEntrance();if(!target)setRoomCamera();requestDraw();
      }
      return result;
    },
    configureJournal(book:JournalManifest,index:number,onReport:(state:BookReport)=>void,onRegion:(region:JournalRegion)=>void,onIntent:(intent:JournalIntent)=>void) {
      journalBook??=createJournalBook(renderer,scene,camera,requestDraw);
      journalBook.configure(book,onReport,onRegion,onIntent);
      journalBook.setInteractionEnabled(journalInteractionEnabled);
      journalBook.setPage(index);journalBook.resize();
    },
    setJournalInteractionEnabled(value:boolean){
      journalInteractionEnabled=value;journalBook?.setInteractionEnabled(value);
      canvas.tabIndex=value?0:-1;
      if(value)canvas.setAttribute("aria-keyshortcuts","Enter Space ArrowLeft ArrowRight PageUp PageDown Escape + - 0");
      else canvas.removeAttribute("aria-keyshortcuts");
    },
    async moveJournal(enter:boolean,duration:number,entrance?:EntranceTransition): Promise<OperationResult> {
      if(!journalBook||failed||destroyed)return {status:"failed",code:"三维书本不可用",retryable:true};
      stopCamera();clearHover();motion.cancel("superseded");zoomed=true;
      if(entrance){entranceFlight=true;entranceProgress=0;entranceUpdate=entrance.onProgress;}
      if(enter){
        journalHomePosition.copy(entrance?roomPosition():camera.position);journalHomeLook.copy(entrance?roomLook():currentLook);
        journalActive=true;showDiary(false);journalBook.activate(true);
      }
      const sample=(value:number)=>{
        if(entrance){entranceProgress=value;entranceUpdate?.(value);}
        const amount=entrance?entranceContentProgress(value):value;
        journalAmount=enter?amount:1-amount;poseJournal();
      };
      const finish=()=>{
        if(entrance)finishEntrance();
        if(!enter){journalActive=false;journalAmount=0;showDiary(true);journalBook?.activate(false);zoomed=false;setRoomCamera();}
        requestDraw();
      };
      const task=motion.start(entrance?.duration??duration,sample);requestDraw();
      const result=await task;
      if(result.status==="completed")finish();
      return result;
    },
    hideJournal() {journalActive=false;journalAmount=0;showDiary(true);journalBook?.activate(false);zoomed=false;setRoomCamera();requestDraw();},
    prepareJournal(reading:boolean){journalBook?.prepare(reading);},
    journalAvailable(){return !failed&&!destroyed;},
    openJournal(value:boolean,preserveView=false):Promise<OperationResult>{return journalBook?.open(value,reducedMotion.matches,preserveView)??Promise.resolve({status:"failed",code:"三维书本尚未准备",retryable:true});},
    journalReady():Promise<OperationResult>{return journalBook?.ready()??Promise.resolve({status:"failed",code:"三维书本尚未准备",retryable:true});},
    cancelJournalPrefetch(){journalBook?.cancelPrefetch();},
    resetJournal(){journalBook?.resetView();},
    setJournalPage(index:number){journalBook?.setPage(index);},
    turnJournal(direction:1|-1){journalBook?.turn(direction,reducedMotion.matches);},
    zoomJournal(value:number){journalBook?.setZoom(value);poseJournal();},
    snapshot() {return {view:viewSnapshot(),lampOn,showDate,drawers:drawers.map(drawer=>drawer.open)};},
    restore(snapshot:{view:RoomView;lampOn:boolean;showDate:boolean;drawers:boolean[]}) {
      resetCameraSpeed();
      roomZoom=targetZoom=snapshot.view.zoom;angle=targetAngle=snapshot.view.angle;elevation=targetElevation=snapshot.view.elevation;
      const offset=(snapshot.view as RoomView).focusOffset;targetOffset.set(offset?.x??0,offset?.y??0,offset?.z??0);constrainOffset();focusOffset.copy(targetOffset);
      this.setLampEnabled(snapshot.lampOn);
      this.setClockMode(snapshot.showDate?"date":"time");
      drawers.forEach((drawer,index)=>{this.setDrawerOpen(drawer.action,Boolean(snapshot.drawers[index]));drawer.moving=false;drawer.group.position.z=workspaceAppearance.drawerFront+drawer.to;});
      setRoomCamera();onViewChange(snapshot.view);requestDraw();
    },
    setPointerEnabled(value:boolean) {
      gestures.setPointerEnabled(value);
      if(!value) {
        stopCamera();requestDraw();
      }
    },
    setActive(value:boolean) {
      const wasActive=active;
      active=value;
      mount.dataset.renderActive=String(value&&!failed);
      if(value) {requestDraw();return;}
      motion.pause();
      journalBook?.pause();
      // Preserve destinations while the page is hidden; only frame clocks pause.
      cameraFrameTime=undefined;
      previousDrawTime=undefined;
      steamFrameTime=undefined;
      environment.pause();mount.dataset.oceanActive="false";
      steam.visible=false;
      mount.dataset.steamActive="false";
      cancelAnimationFrame(frame);
      frame=0;
      chairFrameTime=undefined;breezeFrameTime=undefined;canopy.pause();
      drawers.forEach(drawer=>drawer.frameTime=undefined);
      gestures.reset();
      if(entranceProgress===undefined&&!zoomed&&!motion.running)setRoomCamera();
      if(wasActive&&!failed&&!destroyed)render();
    },
    adjustView(action:RoomViewAction) {
      if(!roomInteractive())return;
      const next=stepRoomView({zoom:targetZoom,angle:targetAngle,elevation:targetElevation},action);
      if(action==='reset-view')targetOffset.set(0,0,0);
      targetAngle=next.angle;targetElevation=next.elevation;changeZoom(next.zoom);
    },
    setDrawerOpen(action:typeof drawerActions[number],open:boolean) {
      const drawer=drawers.find(drawer=>drawer.action===action)!;
      if(drawer.open===open)return;
      clearHover();drawer.open=open;drawer.from=drawer.group.position.z-workspaceAppearance.drawerFront;drawer.to=drawer.open?workspaceAppearance.drawerMaxExtension:0;
      drawer.elapsed=0;drawer.frameTime=undefined;drawer.moving=!reducedMotion.matches;
      if(!drawer.moving)drawer.group.position.z=workspaceAppearance.drawerFront+drawer.to;
      invalidateShadows();
      drawer.group.userData.label=ACTION_LABELS[action].replace("打开",drawer.open?"关闭":"打开");
      requestDraw();
    },
    setLampEnabled(enabled:boolean) {
      if(lampOn===enabled)return;
      clearHover();lampOn=enabled;lamp.intensity=lampOn?lampPower:0;
      diffuserMaterial.emissiveIntensity=lampOn?1.5:0;diffuserMaterial.color.setHex(lampOn?0xffe3aa:0xc7c1b3);
      lampModel.userData.label=lampOn?"关闭台灯":"开启台灯";invalidateShadows();requestDraw();
    },
    setClockMode(mode:"time"|"date") {const value=mode==="date";if(showDate===value)return;clearHover();showDate=value;clockDate=new Date();updateClock();},
    spinChair(reducedMotion=false) {
      if(failed||destroyed)return;
      if(reducedMotion) {chairRocking.reset();chairSeat.rotation.x=0;chairSeat.position.set(0,0,0);invalidateShadows();requestDraw();return;}
      if(!chairRocking.moving)chairFrameTime=undefined;
      chairRocking.push();clearHover();requestDraw();
    },
    setLighting(light:StudioLighting) {
      actualLighting=light;
      applyLighting(debugTimeHour===null?light:studioLighting(debugClockDate(debugTimeHour)));
    },
    setTime(date:Date) {
      clockDate=debugTimeHour===null?date:debugClockDate(debugTimeHour);updateClock();
    },
    moveToSurface(target:"computer"|"canvas",enter:boolean,duration:number,update:(progress:number,rect:{left:number;top:number;width:number;height:number})=>void) {
      stopCamera();motion.cancel("superseded");zoomed=enter;
      clearHover();
      const surface=target==="computer"?computerSurface:canvasSurface;
      const view=surfaceView(surface);
      const opening=entranceFlight&&enter;
      const from=enter&&!opening?camera.position.clone():roomPosition();
      const roomCamera=camera.clone();roomCamera.position.copy(from);roomCamera.lookAt(opening?roomLook():enter?currentLook:roomLook());
      const via=new THREE.Vector3(0,0,1).applyQuaternion(view.rotation).multiplyScalar(Math.max(2.5,from.distanceTo(view.look)*0.65)).add(view.look);
      const {width,height}=deviceSurfaceSize(surface.geometry);
      const sample=(progress:number)=>{
        if(opening){entranceProgress=progress;entranceUpdate?.(progress);progress=entranceContentProgress(progress);}
        // A resize during return must land on the new viewport's room framing.
        if(!enter) {from.copy(roomPosition());roomCamera.position.copy(from);roomCamera.lookAt(roomLook());}
        if(opening){from.copy(roomPosition());roomCamera.position.copy(from);roomCamera.lookAt(roomLook());view.position.copy(surfaceView(surface).position);}
        const {align}=surfacePhases(progress);
        camera.position.fromArray(surfaceFlight(from.toArray(),via.toArray(),view.position.toArray(),view.look.toArray(),progress));
        camera.quaternion.slerpQuaternions(roomCamera.quaternion,view.rotation,align);
        currentLook.copy(progress===0?roomLook():view.look);camera.updateMatrixWorld();
        if(opening)blendEntranceCamera();
        const a=new THREE.Vector3(-width/2,height/2,0).applyMatrix4(surface.matrixWorld).project(camera);
        const b=new THREE.Vector3(width/2,-height/2,0).applyMatrix4(surface.matrixWorld).project(camera);
        const rect=bounds.mount();
        update(progress,{left:rect.left+(a.x+1)*rect.width/2,top:rect.top+(1-a.y)*rect.height/2,width:(b.x-a.x)*rect.width/2,height:(a.y-b.y)*rect.height/2});
      };
      if(failed||destroyed)return Promise.resolve<OperationResult>({status:"failed",code:"三维场景不可用",retryable:true});
      const task=motion.start(duration,progress=>sample(enter?progress:1-progress));requestDraw();return task;
    },
    cancelTransition() {startupVersion++;startupAbort?.abort();entranceFlight=false;entranceUpdate=undefined;entranceProgress=undefined;delete mount.dataset.entranceProgress;stopCamera();clearHover();journalBook?.cancel();motion.cancel("navigation");zoomed=journalActive;if(journalActive)poseJournal();else setRoomCamera();requestDraw();},
    dispose() {if(destroyed)return;destroyed=true;startupVersion++;settleNormals();mount.dataset.renderActive="false";mount.dataset.steamActive="false";mount.dataset.oceanActive="false";environment.pause();clearHover();motion.cancel("disposed");disposeSafely(cleanup.reverse());},
  };
  } catch(error) {
    disposeSafely(cleanup.reverse());
    throw studioFailure(error,"initialization");
  }
}
