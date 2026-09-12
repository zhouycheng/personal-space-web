import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { chairTurn } from "./chairMotion";
import { ACTION_LABELS, type StudioAction } from "./studioState";
import type { studioLighting } from "./studioTime";
import { smooth, surfaceDistance } from "./studioMotion";
import { clockText } from "./studioTime";

export type StudioScene = ReturnType<typeof createStudioScene>;

export function createStudioScene(mount: HTMLElement, onAction: (action: StudioAction) => void, onFailure: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xeee9de, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "工作室场景，拖动改变视角，点击物件探索；Tab 键可访问内容入口");
  canvas.tabIndex = -1;
  mount.append(canvas);
  const scene = new THREE.Scene();
  const room = new THREE.Group(); scene.add(room);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const focus = new THREE.Vector3(-0.3, 1.05, -0.65);
  const events = new AbortController();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const tooltip = mount.querySelector<HTMLElement>("[data-studio-tooltip]")!;
  const ray = new THREE.Raycaster();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let hoverTimer = 0;
  let hoverFocused = false;
  let hoverMotion: { start:number; from:THREE.Vector3; to:THREE.Vector3; lookFrom:THREE.Vector3; lookTo:THREE.Vector3 } | undefined;
  let active = true;
  let destroyed = false;
  let failed = false;
  let frame = 0;
  let angle = -0.48;
  let elevation = 0.55;
  let zoomed = false;
  let hovering: THREE.Group | undefined;
  let down: { x: number; y: number; angle: number; elevation: number; moved: boolean } | undefined;
  let motion: { start: number; duration: number; from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; enter: boolean; update: (progress: number) => void; resolve: () => void } | undefined;
  let chairElapsed: number | undefined;
  let chairFrameTime: number | undefined;
  const currentLook = focus.clone();

  function material(color: number, roughness = 0.8) {
    const m = new THREE.MeshStandardMaterial({ color, roughness }); materials.add(m); return m;
  }
  const wood = material(0xac7d50);
  const charcoal = material(0x303b39), brass = material(0xab8a48, 0.4), paper = material(0xfff9e9);
  const furnitureFrame = material(0x28354a), upholstery = material(0xb9b1a2, 0.95);
  const blue = material(0x002fa7);
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat); object.position.set(x,y,z);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  function box(parent: THREE.Object3D, size: number[], at: number[], mat = wood) {
    return mesh(parent,new THREE.BoxGeometry(...size as [number,number,number]),mat,...at as [number,number,number]);
  }
  function cylinder(parent: THREE.Object3D, radius: number, height: number, at: number[], mat = charcoal, top = radius) {
    return mesh(parent,new THREE.CylinderGeometry(top,radius,height,16),mat,...at as [number,number,number]);
  }
  function rounded(parent: THREE.Object3D, size: [number,number,number], at: [number,number,number], mat: THREE.Material, radius: number) {
    return mesh(parent,new RoundedBoxGeometry(...size,2,radius),mat,...at);
  }
  function hotspot(action: StudioAction) {
    const group = new THREE.Group(); group.userData.action = action; room.add(group); return group;
  }
  function label(parent: THREE.Object3D, text: string, width: number, height: number, at: number[], background = "#002fa7", color = "#fff9e9", fontScale = 0.156) {
    const image = document.createElement("canvas"); image.width=1024;image.height=Math.round(1024*height/width);
    const ctx = image.getContext("2d")!;
    ctx.fillStyle=background;ctx.fillRect(0,0,image.width,image.height);ctx.fillStyle=color;
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`600 ${Math.round(image.height*fontScale)}px monospace`;ctx.fillText(text,image.width/2,image.height/2,image.width*0.9);
    const texture = new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.add(texture);
    const m = new THREE.MeshBasicMaterial({map:texture});materials.add(m);
    return mesh(parent,new THREE.PlaneGeometry(width,height),m,...at as [number,number,number]);
  }

  // Transparent shadow receiver: no visible floor slab or room enclosure.
  const shadowMaterial=new THREE.ShadowMaterial({color:0x060910,opacity:0.34});materials.add(shadowMaterial);
  // The ground receives the broad overhead light only. A spot shadow mask
  // includes unlit space outside the lamp cone, even where its light cannot reach.
  shadowMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace("#include <shadowmask_pars_fragment>",
      THREE.ShaderChunk.shadowmask_pars_fragment.replace("#if NUM_SPOT_LIGHT_SHADOWS > 0", "#if 0"));
  };
  const shadow=mesh(scene,new THREE.PlaneGeometry(200,200),shadowMaterial,0,0.01,0);
  shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;

  // Work desk, drawers, keyboard, chair.
  rounded(room,[3.5,0.14,1.5],[0,1.36,-1.3],wood,0.025);
  for(const z of [-1.9,-0.7]) box(room,[0.09,1.3,0.09],[1.55,0.65,z],charcoal);
  box(room,[0.72,1.28,1.2],[-1.25,0.65,-1.3],furnitureFrame);
  for(let i=0;i<3;i++) {box(room,[0.65,0.36,0.04],[-1.25,0.27+i*0.4,-0.68],upholstery);box(room,[0.22,0.025,0.035],[-1.25,0.36+i*0.4,-0.645],brass);}
  // 2023 16-inch MacBook Pro: 35.57 × 24.81 cm footprint, space grey.
  // Stylized at room scale; the lid, keyboard and trackpad belong to one hotspot.
  const computer = hotspot("computer");
  const aluminum=material(0x8c9198,0.4);aluminum.metalness=0.55;
  const keycap=material(0x22262b), rubber=material(0x202523), chrome=material(0x999f9c,0.3);chrome.metalness=0.65;
  rounded(computer,[1.6,0.06,1.116],[-0.2,1.47,-1.32],aluminum,0.028);
  rounded(computer,[1.05,0.012,0.45],[-0.2,1.5,-1.46],keycap,0.02);
  for(let row=0;row<5;row++) for(let col=0;col<12;col++) {
    box(computer,[0.067,0.007,row===0?0.046:0.059],[-0.674+col*0.086,1.511,-1.635+row*0.078],charcoal);
  }
  box(computer,[0.39,0.009,0.047],[-0.2,1.512,-1.286],charcoal);
  cylinder(computer,0.024,0.009,[0.273,1.519,-1.635],keycap);
  rounded(computer,[0.67,0.006,0.3],[-0.2,1.504,-1.019],chrome,0.017);
  for(const x of [-0.9,0.5]) for(let i=0;i<12;i++) box(computer,[0.11,0.004,0.012],[x,1.504,-1.66+i*0.03],keycap);
  box(computer,[0.23,0.013,0.009],[-0.2,1.479,-0.758],charcoal);
  for(const z of [-1.7,-1.53,-1.28]) box(computer,[0.008,0.018,0.07],[-1.002,1.47,z],keycap);
  for(const z of [-1.7,-1.49,-1.25]) box(computer,[0.008,0.018,z===-1.49?0.12:0.07],[0.602,1.47,z],keycap);
  const lid=new THREE.Group();computer.add(lid);lid.position.set(-0.2,1.505,-1.84);lid.rotation.x=-0.23;lid.scale.set(1.127,1.127,1);
  rounded(lid,[1.42,0.91,0.035],[0,0.455,0],aluminum,0.017);
  rounded(lid,[1.38,0.873,0.011],[0,0.455,0.022],keycap,0.005);
  const computerSurface=label(lid,"Justin OS",1.31,0.81,[0,0.457,0.029]);
  rounded(lid,[0.18,0.041,0.007],[0,0.851,0.033],keycap,0.003);
  mesh(lid,new THREE.SphereGeometry(0.006,8,6),chrome,0,0.851,0.038);
  const hinge=cylinder(computer,0.027,1.32,[-0.2,1.5,-1.84],keycap);hinge.rotation.z=Math.PI/2;
  // 35.57 cm laptop on an approximately 130 cm desk; scale around the tabletop.
  const laptopScale=0.6;
  computer.scale.setScalar(laptopScale);
  computer.position.set(-0.2,1.43,-1.3).multiplyScalar(1-laptopScale);
  computer.updateWorldMatrix(true,true);

  // Whole-chair turn: casters align to the circular path and wheels roll along it.
  const chair=hotspot("chair");chair.position.set(-0.2,0,0.18);
  const seat=new THREE.Group();chair.add(seat);
  const casters: { group: THREE.Group; startAngle: number }[]=[];
  const chairWheels: { group: THREE.Group; pathRadius: number }[]=[];
  cylinder(chair,0.09,0.28,[0,0.36,0],furnitureFrame);
  cylinder(chair,0.044,0.3,[0,0.6,0],chrome);
  rounded(seat,[0.56,0.08,0.5],[0,0.75,0],furnitureFrame,0.03);
  rounded(seat,[0.87,0.16,0.84],[0,0.87,0],upholstery,0.07);
  const back=new THREE.Group();seat.add(back);back.position.set(0,0.96,0.36);back.rotation.x=0.12;
  rounded(back,[0.82,0.87,0.13],[0,0.38,0.055],furnitureFrame,0.06);
  rounded(back,[0.75,0.78,0.12],[0,0.39,-0.015],upholstery,0.055);
  rounded(back,[0.6,0.15,0.075],[0,0.12,-0.08],upholstery,0.035);
  for(const x of [-0.5,0.5]) {
    rounded(seat,[0.047,0.34,0.09],[x,1.0,0.09],furnitureFrame,0.02);
    rounded(seat,[0.15,0.07,0.53],[x,1.19,0.015],furnitureFrame,0.03);
  }
  const lever=cylinder(seat,0.014,0.3,[0.31,0.75,0.19],chrome);lever.rotation.z=Math.PI/2;
  rounded(seat,[0.13,0.04,0.07],[0.48,0.75,0.19],charcoal,0.015);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const spoke=new THREE.Group();chair.add(spoke);spoke.rotation.y=a;
    const leg=rounded(spoke,[0.1,0.075,0.65],[0,0.24,0.31],furnitureFrame,0.035);leg.rotation.x=0.12;
    const caster=new THREE.Group();spoke.add(caster);caster.position.set(0,0,0.63);caster.rotation.y=0.25;
    casters.push({group:caster,startAngle:caster.rotation.y});
    cylinder(caster,0.025,0.1,[0,0.205,0],chrome);
    rounded(caster,[0.09,0.08,0.12],[0,0.17,0.025],furnitureFrame,0.02);
    for(const x of [-0.065,0.065]) {
      const rolling=new THREE.Group();caster.add(rolling);rolling.position.set(x,0.14,0.043);
      chairWheels.push({group:rolling,pathRadius:Math.hypot(0.63-x,0.043)});
      const wheel=cylinder(rolling,0.085,0.045,[0,0,0],rubber);wheel.rotation.z=Math.PI/2;
      const hub=cylinder(rolling,0.033,0.047,[0,0,0],chrome);hub.rotation.z=Math.PI/2;
      // Small hub mark makes the wheel's rolling motion readable at room scale.
      box(rolling,[0.049,0.012,0.045],[0,0.045,0],chrome);
    }
  }

  // Flat iPad replaces the introduction folder and opens the personal canvas.
  const tablet=hotspot("canvas");tablet.position.set(1.04,1.45,-1.1);
  rounded(tablet,[0.78,0.035,0.58],[0,0,0],aluminum,0.025);
  rounded(tablet,[0.755,0.006,0.555],[0,0.02,0],keycap,0.024);
  const canvasSurface=label(tablet,"MY CANVAS",0.69,0.49,[0,0.024,0],"#fff9e9","#002fa7",0.16);
  canvasSurface.rotation.x=-Math.PI/2;
  cylinder(tablet,0.008,0.003,[0,0.025,-0.263],chrome);
  const pencil=cylinder(tablet,0.014,0.48,[0.43,0.005,0],paper);pencil.rotation.x=Math.PI/2;
  box(tablet,[0.004,0.012,0.055],[0.391,0,0],keycap);

  // Desktop document rack retains the portfolio hotspot.
  const library=hotspot("works");
  for(const x of [-1.57,-0.93]) box(library,[0.035,0.52,0.42],[x,1.69,-1.65],charcoal);
  for(let row=0;row<3;row++) {
    box(library,[0.69,0.035,0.46],[-1.25,1.46+row*0.19,-1.65],charcoal);
    box(library,[0.55,0.055,0.36],[-1.25,1.51+row*0.19,-1.65],row===1?blue:paper);
  }
  cylinder(room,0.095,0.17,[-0.78,1.52,-0.85],paper);
  const handle=mesh(room,new THREE.TorusGeometry(0.065,0.018,6,12),paper,-0.68,1.54,-0.85);handle.rotation.y=Math.PI/2;

  // Angled desktop clock: one reusable texture, sourced from the visitor's clock.
  const deskClock=new THREE.Group();room.add(deskClock);deskClock.position.set(-1.3,1.58,-0.83);deskClock.rotation.y=0.25;deskClock.userData.label="电子钟 · 本地时间";
  rounded(deskClock,[0.61,0.27,0.15],[0,0,0],charcoal,0.025);
  const clockFace=label(deskClock,"",0.55,0.21,[0,0,0.079],"#101d1d","#b5edc7",0.63);
  const clockTexture=(clockFace.material as THREE.MeshBasicMaterial).map!;
  const clockImage=clockTexture.image as HTMLCanvasElement;
  let displayedTime="";

  // Articulated task lamp with an open shade and a downward, shadow-casting cone.
  const lampModel=new THREE.Group();room.add(lampModel);lampModel.userData.label="关节台灯";
  const base=new THREE.Vector3(1.32,1.48,-1.79),elbow=new THREE.Vector3(1.48,1.97,-1.82),head=new THREE.Vector3(0.99,2.29,-1.56);
  cylinder(lampModel,0.19,0.055,[base.x,base.y-0.02,base.z],charcoal);
  for(const [a,b] of [[base,elbow],[elbow,head]]) {
    const arm=cylinder(lampModel,0.024,a.distanceTo(b),a.clone().add(b).multiplyScalar(0.5).toArray(),charcoal);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  }
  for(const point of [base,elbow,head]) mesh(lampModel,new THREE.SphereGeometry(0.047,12,8),brass,...point.toArray() as [number,number,number]);
  const lampTarget=new THREE.Object3D();lampTarget.position.set(0.65,1.43,-1.02);scene.add(lampTarget);
  const shade=new THREE.Group();lampModel.add(shade);shade.position.copy(head);
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),lampTarget.position.clone().sub(head).normalize());
  const shadeMaterial=material(0x59645c,0.45);shadeMaterial.side=THREE.DoubleSide;
  mesh(shade,new THREE.CylinderGeometry(0.09,0.22,0.2,32,1,true),shadeMaterial,0,0,0);
  const diffuserMaterial=new THREE.MeshBasicMaterial({color:0xffe3aa});materials.add(diffuserMaterial);
  const diffuser=mesh(shade,new THREE.CircleGeometry(0.19,32),diffuserMaterial,0,-0.087,0);diffuser.rotation.x=Math.PI/2;diffuser.castShadow=false;
  const lamp=new THREE.SpotLight(0xffdfb0,0,5,Math.PI/3.5,0.72,2);
  lamp.position.copy(new THREE.Vector3(0,-0.12,0).applyQuaternion(shade.quaternion).add(head));lamp.target=lampTarget;
  lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=0.05;lamp.shadow.camera.far=5;
  lamp.shadow.bias=-0.0002;lamp.shadow.normalBias=0.008;scene.add(lamp);
  const ambient=new THREE.HemisphereLight(0xfff6e5,0x746b51,2.6);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffedce,3.2);sun.position.set(-3,7,2.5);sun.castShadow=true;
  sun.target.position.set(0,0,-0.8);scene.add(sun.target);
  sun.shadow.radius=12;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-3.8;sun.shadow.camera.right=3.8;sun.shadow.camera.top=3.8;sun.shadow.camera.bottom=-3.8;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=16;sun.shadow.normalBias=0.012;sun.shadow.bias=-0.0001;scene.add(sun);

  function roomPosition() {
    const aspect=Math.max(0.3,mount.clientWidth/Math.max(1,mount.clientHeight));
    const distance=Math.max(8.5,8.5/aspect);
    return new THREE.Vector3(Math.sin(angle)*distance,Math.sin(elevation)*distance,Math.cos(angle)*distance).add(focus);
  }
  function setRoomCamera() {camera.position.copy(roomPosition());currentLook.copy(focus);camera.lookAt(currentLook);}
  function draw(now:number) {
    frame=0;
    if(!active||destroyed||failed) return;
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
    if(hoverMotion&&!motion) {
      const t=Math.min(1,(now-hoverMotion.start)/700),eased=smooth(t);
      camera.position.lerpVectors(hoverMotion.from,hoverMotion.to,eased);currentLook.lerpVectors(hoverMotion.lookFrom,hoverMotion.lookTo,eased);camera.lookAt(currentLook);
      if(t===1)hoverMotion=undefined;
    }
    if(motion) {
      const t=Math.min(1,(now-motion.start)/Math.max(1,motion.duration));const eased=t*t*(3-2*t);
      camera.position.lerpVectors(motion.from,motion.to,eased);currentLook.lerpVectors(motion.lookFrom,motion.lookTo,eased);camera.lookAt(currentLook);
      camera.updateMatrixWorld();
      motion.update(motion.enter?t:1-t);
      if(t===1) {const done=motion.resolve;motion=undefined;done();}
    }
    renderer.render(scene,camera);
    if(motion||hoverMotion||chairElapsed!==undefined) frame=requestAnimationFrame(draw);
  }
  function requestDraw() {if(active&&!frame&&!destroyed&&!failed) frame=requestAnimationFrame(draw);}
  function surfaceView(surface: THREE.Mesh) {
    surface.updateWorldMatrix(true,false);
    const {width,height}=(surface.geometry as THREE.PlaneGeometry).parameters;
    const scale=surface.getWorldScale(new THREE.Vector3());
    const look=surface.getWorldPosition(new THREE.Vector3());
    const distance=surfaceDistance(width*scale.x,height*scale.y,camera.aspect,camera.fov);
    const position=new THREE.Vector3(0,0,1).transformDirection(surface.matrixWorld).multiplyScalar(distance).add(look);
    return {position,look};
  }
  function resize() {
    const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    clearHover(false);if(!zoomed&&!motion)setRoomCamera();requestDraw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  function clearHover(restore=true) {
    clearTimeout(hoverTimer);hoverTimer=0;
    if(hoverFocused&&restore&&active&&!motion&&!zoomed&&!reducedMotion.matches) {
      hoverMotion={start:performance.now(),from:camera.position.clone(),to:roomPosition(),lookFrom:currentLook.clone(),lookTo:focus.clone()};requestDraw();
    } else if(!restore||!active||reducedMotion.matches) hoverMotion=undefined;
    hoverFocused=false;
    hovering=undefined;tooltip.hidden=true;canvas.style.cursor="grab";
  }
  // Delayed, reversible framing only; hovering never opens a route.
  function focusHovered() {
    if(!hovering||!active||motion||down||reducedMotion.matches)return;
    const center=new THREE.Box3().setFromObject(hovering).getCenter(new THREE.Vector3());
    hoverFocused=true;
    hoverMotion={start:performance.now(),from:camera.position.clone(),to:roomPosition().lerp(center,0.06),lookFrom:currentLook.clone(),lookTo:focus.clone().lerp(center,0.12)};
    requestDraw();
  }
  function pick(event:PointerEvent) {
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObjects(room.children,true)[0];
    let object: THREE.Object3D | null=hit?.object ?? null;
    while(object && !object.userData.action&&!object.userData.label)object=object.parent;
    return (object??undefined) as THREE.Group | undefined;
  }
  canvas.addEventListener("pointerdown",event=>{if(!active||motion||event.button!==0)return;clearTimeout(hoverTimer);down={x:event.clientX,y:event.clientY,angle,elevation,moved:false};canvas.setPointerCapture(event.pointerId);}, {signal:events.signal});
  canvas.addEventListener("pointermove",event=>{
    if(!active||motion)return;
    if(down) {
      if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)down.moved=true;
      if(down.moved) {angle=THREE.MathUtils.clamp(down.angle-(event.clientX-down.x)*0.002,-0.9,0.12);elevation=THREE.MathUtils.clamp(down.elevation+(event.clientY-down.y)*0.001,0.28,0.7);clearHover(false);setRoomCamera();requestDraw();}
      return;
    }
    const hit=pick(event);
    if(hit!==hovering) {clearHover();hovering=hit;if(hit&&event.pointerType==="mouse")hoverTimer=window.setTimeout(focusHovered,1000);}
    if(hovering) {
      tooltip.textContent=hovering.userData.label??ACTION_LABELS[hovering.userData.action as StudioAction];tooltip.hidden=false;
      const rect=mount.getBoundingClientRect();tooltip.style.left=`${Math.max(4,Math.min(rect.width-155,event.clientX-rect.left+14))}px`;tooltip.style.top=`${Math.max(4,event.clientY-rect.top-42)}px`;canvas.style.cursor=hovering.userData.action?"pointer":"help";
    }
  },{signal:events.signal});
  canvas.addEventListener("pointerup",event=>{const click=down&&!down.moved;down=undefined;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(click) {const hit=pick(event);if(hit?.userData.action)onAction(hit.userData.action);}},{signal:events.signal});
  canvas.addEventListener("pointercancel",()=>{down=undefined;clearHover();},{signal:events.signal});
  canvas.addEventListener("pointerleave",()=>clearHover(),{signal:events.signal});
  reducedMotion.addEventListener("change",()=>{clearHover(false);if(!motion&&!zoomed)setRoomCamera();requestDraw();},{signal:events.signal});
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();failed=true;clearHover(false);mount.dataset.renderActive="false";cancelAnimationFrame(frame);frame=0;motion?.resolve();motion=undefined;canvas.hidden=true;onFailure();},{signal:events.signal});
  setRoomCamera();resize();
  return {
    setActive(value:boolean) {const wasActive=active;active=value;mount.dataset.renderActive=String(value&&!failed);if(!value) {cancelAnimationFrame(frame);frame=0;chairFrameTime=undefined;clearHover(false);down=undefined;if(!zoomed&&!motion)setRoomCamera();if(wasActive&&!failed&&!destroyed)renderer.render(scene,camera);}else requestDraw();},
    spinChair(reducedMotion=false) {
      if(failed||destroyed||chairElapsed!==undefined)return;
      if(reducedMotion) {chair.rotation.y=0;requestDraw();return;}
      for(const caster of casters)caster.startAngle=caster.group.rotation.y;
      chairElapsed=0;chairFrameTime=undefined;clearHover();requestDraw();
    },
    setLighting(light:ReturnType<typeof studioLighting>) {
      sun.intensity=1.1+2.1*light.daylight;sun.color.setHex(light.sun);
      ambient.intensity=1.15+1.05*light.daylight;lamp.intensity=2.8*(1-light.daylight)+0.25;
      requestDraw();
    },
    setTime(date:Date) {
      const time=clockText(date);if(time===displayedTime)return;displayedTime=time;
      const ctx=clockImage.getContext("2d")!;
      ctx.fillStyle="#101d1d";ctx.fillRect(0,0,clockImage.width,clockImage.height);ctx.fillStyle="#b5edc7";
      ctx.fillText(time,clockImage.width/2,clockImage.height/2,clockImage.width*0.92);clockTexture.needsUpdate=true;
      canvas.setAttribute("aria-label",`工作室场景，桌角时钟 ${time}；拖动改变视角，Tab 键可访问内容入口`);requestDraw();
    },
    moveToSurface(target:"computer"|"canvas",enter:boolean,duration:number,update:(progress:number)=>void) {
      motion?.resolve();zoomed=enter;
      clearHover(false);
      const surface=target==="computer"?computerSurface:canvasSurface;
      const view=surfaceView(surface);
      if(!enter) {camera.position.copy(view.position);currentLook.copy(view.look);}
      const to=enter?view.position:roomPosition(),lookTo=enter?view.look:focus;
      if(!duration||failed) {camera.position.copy(to);currentLook.copy(lookTo);camera.lookAt(currentLook);requestDraw();return Promise.resolve();}
      camera.lookAt(currentLook);camera.updateMatrixWorld();update(enter?0:1);
      return new Promise<void>(resolve=>{motion={start:performance.now(),duration,from:camera.position.clone(),to:to.clone(),lookFrom:currentLook.clone(),lookTo:lookTo.clone(),enter,update,resolve};requestDraw();});
    },
    cancelTransition() {clearHover(false);motion?.resolve();motion=undefined;zoomed=false;setRoomCamera();requestDraw();},
    dispose() {destroyed=true;clearHover(false);cancelAnimationFrame(frame);motion?.resolve();events.abort();resizeObserver.disconnect();sun.shadow.map?.dispose();lamp.shadow.map?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();canvas.remove();},
  };
}
