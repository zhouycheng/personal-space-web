import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { chairTurn } from "./chairMotion";
import { ACTION_LABELS, type StudioAction } from "./studioState";
import type { studioLighting } from "./studioTime";
import { surfaceDistance } from "./studioMotion";

export type StudioScene = ReturnType<typeof createStudioScene>;

export function createStudioScene(mount: HTMLElement, onAction: (action: StudioAction) => void, onFailure: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  const focus = new THREE.Vector3(0, 1.2, -0.2);
  const events = new AbortController();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const tooltip = mount.querySelector<HTMLElement>("[data-studio-tooltip]")!;
  const ray = new THREE.Raycaster();
  const outline = new THREE.BoxHelper(new THREE.Object3D(), 0x002fa7);
  outline.visible = false; scene.add(outline);
  let active = true;
  let destroyed = false;
  let failed = false;
  let frame = 0;
  let angle = 0.25;
  let elevation = 0.47;
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
  const cream = material(0xede6d6), wood = material(0xac7d50), edge = material(0x775a41);
  const charcoal = material(0x303b39), brass = material(0xab8a48, 0.4), paper = material(0xfff9e9);
  const blue = material(0x002fa7), terracotta = material(0xb26849), sage = material(0x697b57);
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

  // Open-front room: the wall and object scale are shared by all camera views.
  box(room,[8.2,0.22,6.2],[0,-0.14,0],edge);
  const planks = [0xb58d63,0xbf996d,0xb18a60,0xc3a177].map(c => material(c));
  for(let row=0;row<15;row++) for(let col=0;col<4;col++) {
    box(room,[1.985,0.06,0.39],[-3+col*2,0,row*0.4-2.8],planks[(row+col*3)%4]);
  }
  box(room,[8.2,3.5,0.14],[0,1.73,-3.06],cream);
  // Leave a real window opening: z -1.0..1.3, y 1.18..3.12.
  box(room,[0.14,1.2,6.15],[-4.06,0.58,0],cream);
  box(room,[0.14,0.36,6.15],[-4.06,3.3,0],cream);
  box(room,[0.14,1.94,2.075],[-4.06,2.15,-2.0375],cream);
  box(room,[0.14,1.94,1.775],[-4.06,2.15,2.1875],cream);
  box(room,[8.1,0.12,0.1],[0,0.11,-2.94],paper);
  box(room,[0.1,0.12,6],[-3.94,0.11,0],paper);

  // Work desk, drawers, keyboard, chair.
  box(room,[3.5,0.14,1.35],[0,1.36,-1.3]);
  for(const x of [-1.57,1.57]) for(const z of [-1.82,-0.78]) box(room,[0.09,1.3,0.09],[x,0.65,z],charcoal);
  box(room,[0.68,1.18,1.02],[-1.05,0.63,-1.3],charcoal);
  for(let i=0;i<3;i++) {box(room,[0.61,0.34,0.04],[-1.05,0.3+i*0.37,-0.77],sage);box(room,[0.22,0.025,0.035],[-1.05,0.39+i*0.37,-0.735],brass);}
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
  const chair=hotspot("chair");chair.position.z=0.4;
  const seat=new THREE.Group();chair.add(seat);
  const casters: { group: THREE.Group; startAngle: number }[]=[];
  const chairWheels: { group: THREE.Group; pathRadius: number }[]=[];
  cylinder(chair,0.09,0.28,[0,0.36,0],charcoal);
  cylinder(chair,0.044,0.3,[0,0.6,0],chrome);
  rounded(seat,[0.56,0.08,0.5],[0,0.75,0],charcoal,0.03);
  rounded(seat,[0.87,0.16,0.84],[0,0.87,0],sage,0.07);
  const back=new THREE.Group();seat.add(back);back.position.set(0,0.96,0.36);back.rotation.x=0.12;
  rounded(back,[0.82,0.87,0.13],[0,0.38,0.055],charcoal,0.06);
  rounded(back,[0.75,0.78,0.12],[0,0.39,-0.015],sage,0.055);
  rounded(back,[0.6,0.15,0.075],[0,0.12,-0.08],sage,0.035);
  for(const x of [-0.5,0.5]) {
    rounded(seat,[0.047,0.34,0.09],[x,1.0,0.09],charcoal,0.02);
    rounded(seat,[0.15,0.07,0.53],[x,1.19,0.015],charcoal,0.03);
  }
  const lever=cylinder(seat,0.014,0.3,[0.31,0.75,0.19],chrome);lever.rotation.z=Math.PI/2;
  rounded(seat,[0.13,0.04,0.07],[0.48,0.75,0.19],charcoal,0.015);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const spoke=new THREE.Group();chair.add(spoke);spoke.rotation.y=a;
    const leg=rounded(spoke,[0.1,0.075,0.65],[0,0.24,0.31],charcoal,0.035);leg.rotation.x=0.12;
    const caster=new THREE.Group();spoke.add(caster);caster.position.set(0,0,0.63);caster.rotation.y=0.25;
    casters.push({group:caster,startAngle:caster.rotation.y});
    cylinder(caster,0.025,0.1,[0,0.205,0],chrome);
    rounded(caster,[0.09,0.08,0.12],[0,0.17,0.025],charcoal,0.02);
    for(const x of [-0.065,0.065]) {
      const rolling=new THREE.Group();caster.add(rolling);rolling.position.set(x,0.14,0.043);
      chairWheels.push({group:rolling,pathRadius:Math.hypot(0.63-x,0.043)});
      const wheel=cylinder(rolling,0.085,0.045,[0,0,0],rubber);wheel.rotation.z=Math.PI/2;
      const hub=cylinder(rolling,0.033,0.047,[0,0,0],chrome);hub.rotation.z=Math.PI/2;
      // Small hub mark makes the wheel's rolling motion readable at room scale.
      box(rolling,[0.049,0.012,0.045],[0,0.045,0],chrome);
    }
  }

  // Personal canvas stays on the wall while the camera approaches its surface.
  const works = hotspot("canvas");
  box(works,[2.7,1.5,0.1],[0.25,2.49,-2.92],edge);
  box(works,[2.54,1.34,0.045],[0.25,2.49,-2.85],charcoal);
  const canvasSurface=mesh(works,new THREE.PlaneGeometry(2.54,1.34),paper,0.25,2.49,-2.816);
  label(works,"MY CANVAS",2.15,0.3,[0.25,2.97,-2.79],"#fff9e9","#303b39",0.48);
  for(let i=0;i<2;i++) {
    const x=-0.35+i*1.2;
    box(works,[1.08,0.83,0.024],[x,2.36,-2.81],paper);
    label(works,i===0?"IDEAS":"NOTES",1.0,0.35,[x,2.49,-2.793],i===0?"#002fa7":"#ac7d50","#fff9e9",0.48);
    for(let j=0;j<2;j++) box(works,[0.78-j*0.18,0.025,0.005],[x,2.19-j*0.1,-2.79],sage);
    mesh(works,new THREE.SphereGeometry(0.025,8,8),brass,x,2.76,-2.78);
  }
  const about = hotspot("about");
  const folder=box(about,[0.53,0.045,0.69],[0.97,1.47,-1.15],terracotta);folder.rotation.y=-0.16;
  const sheet=box(about,[0.44,0.015,0.57],[0.97,1.5,-1.15],paper);sheet.rotation.y=-0.16;
  const cv=label(about,"ABOUT ME",0.38,0.19,[0.97,1.51,-1.15],"#fff9e9","#303b39");cv.rotation.x=-Math.PI/2;
  const contact=hotspot("contact");box(contact,[0.36,0.22,0.06],[1.44,1.57,-1.77],brass);label(contact,"HELLO",0.32,0.17,[1.44,1.58,-1.73],"#fff9e9","#002fa7");

  // Bookshelf: books have varying heights but a deterministic arrangement.
  const library=hotspot("works");
  for(const x of [-3.6,-2.35]) box(library,[0.055,2.8,0.48],[x,1.44,-2.36],charcoal);
  const bookColors=[blue,terracotta,sage,paper,brass];
  for(let row=0;row<4;row++) {
    box(library,[1.4,0.07,0.55],[-2.98,0.26+row*0.72,-2.36]);
    for(let col=0;col<7;col++) {
      const h=0.33+((row+col)%3)*0.075;
      box(library,[0.1,h,0.33],[-3.46+col*0.15,0.3+row*0.72+h/2,-2.34],bookColors[(row+col)%5]);
    }
  }

  // Window lighting follows the visitor's local clock.
  const windowGroup=new THREE.Group();room.add(windowGroup);
  const skyMaterial=material(0x9ebcb5);skyMaterial.emissive.setHex(0x93b6b2);skyMaterial.emissiveIntensity=0.18;
  // Recessed double casement: casing, two glazed sashes, sill and handles.
  box(windowGroup,[0.035,1.94,2.3],[-4.13,2.15,0.15],skyMaterial);
  for(const z of [-1,1.3]) box(windowGroup,[0.24,2.08,0.12],[-4.01,2.15,z],paper);
  for(const y of [1.18,3.12]) box(windowGroup,[0.24,0.12,2.42],[-4.01,y,0.15],paper);
  for(const z of [-0.9,0.15,1.2]) box(windowGroup,[0.12,1.82,0.06],[-4.0,2.15,z],cream);
  for(const y of [1.28,3.02]) box(windowGroup,[0.12,0.06,2.1],[-4.0,y,0.15],cream);
  box(windowGroup,[0.46,0.09,2.54],[-3.88,1.14,0.15],paper);
  for(const z of [0.04,0.26]) {
    box(windowGroup,[0.055,0.2,0.045],[-3.9,2.03,z],brass);
    box(windowGroup,[0.08,0.035,0.045],[-3.87,2.11,z],brass);
  }

  function plant(x:number,z:number,scale=1) {
    const group=new THREE.Group();room.add(group);group.position.set(x,0.08,z);group.scale.setScalar(scale);
    cylinder(group,0.26,0.44,[0,0.22,0],terracotta,0.31);
    for(let i=0;i<7;i++) {
      const a=i*2.4, h=0.55+(i%3)*0.18;
      const stem=cylinder(group,0.018,h,[Math.sin(a)*0.1,0.4+h/2,Math.cos(a)*0.1],sage);
      stem.rotation.z=Math.sin(a)*0.18;
      const leaf=mesh(group,new THREE.SphereGeometry(1,7,5),sage,Math.sin(a)*0.26,0.4+h,Math.cos(a)*0.26);
      leaf.scale.set(0.19,0.34,0.09);leaf.rotation.set(0,a,Math.sin(a)*0.65);
    }
  }
  plant(3.15,-2.18,1.25);
  cylinder(room,0.095,0.17,[-1.18,1.52,-0.95],paper);
  const handle=mesh(room,new THREE.TorusGeometry(0.065,0.018,6,12),paper,-1.08,1.54,-0.95);handle.rotation.y=Math.PI/2;

  // Standing lamp.
  cylinder(room,0.28,0.065,[2.18,0.08,-1.68],charcoal);cylinder(room,0.027,2.6,[2.18,1.39,-1.68],brass);
  cylinder(room,0.37,0.3,[2.18,2.66,-1.68],cream,0.2);
  const lamp=new THREE.PointLight(0xffcf83,0,4,2);lamp.position.set(2.18,2.4,-1.68);scene.add(lamp);
  const ambient=new THREE.HemisphereLight(0xfff6e5,0x746b51,2.6);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffedce,3.2);sun.position.set(-3,7,5);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;sun.shadow.normalBias=0.035;scene.add(sun);

  function roomPosition() {
    const aspect=Math.max(0.3,mount.clientWidth/Math.max(1,mount.clientHeight));
    const distance=Math.max(11.4,15.5/aspect);
    return new THREE.Vector3(Math.sin(angle)*distance,Math.sin(elevation)*distance+1,Math.cos(angle)*distance);
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
      if(hovering===chair)outline.setFromObject(chair);
      if(turn.done) {chair.rotation.y=0;chairElapsed=undefined;chairFrameTime=undefined;}
    }
    if(motion) {
      const t=Math.min(1,(now-motion.start)/Math.max(1,motion.duration));const eased=t*t*(3-2*t);
      camera.position.lerpVectors(motion.from,motion.to,eased);currentLook.lerpVectors(motion.lookFrom,motion.lookTo,eased);camera.lookAt(currentLook);
      camera.updateMatrixWorld();
      motion.update(motion.enter?t:1-t);
      if(t===1) {const done=motion.resolve;motion=undefined;done();}
    }
    renderer.render(scene,camera);
    if(motion||chairElapsed!==undefined) frame=requestAnimationFrame(draw);
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
    if(!zoomed&&!motion)setRoomCamera();requestDraw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  function clearHover() {
    outline.visible=false;requestDraw();
    hovering=undefined;tooltip.hidden=true;canvas.style.cursor="grab";
  }
  // Outline avoids mutating materials shared by room furniture.
  function pick(event:PointerEvent) {
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObjects(room.children,true)[0];
    let object: THREE.Object3D | null=hit?.object ?? null;
    while(object && !object.userData.action)object=object.parent;
    return object as THREE.Group | undefined;
  }
  canvas.addEventListener("pointerdown",event=>{if(!active||motion||event.button!==0)return;down={x:event.clientX,y:event.clientY,angle,elevation,moved:false};canvas.setPointerCapture(event.pointerId);}, {signal:events.signal});
  canvas.addEventListener("pointermove",event=>{
    if(!active||motion)return;
    if(down) {
      if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)down.moved=true;
      if(down.moved) {angle=THREE.MathUtils.clamp(down.angle-(event.clientX-down.x)*0.002,-0.22,0.65);elevation=THREE.MathUtils.clamp(down.elevation+(event.clientY-down.y)*0.001,0.28,0.65);setRoomCamera();clearHover();requestDraw();}
      return;
    }
    clearHover();hovering=pick(event);
    if(hovering) {
      outline.setFromObject(hovering);outline.visible=true;requestDraw();
      tooltip.textContent=ACTION_LABELS[hovering.userData.action as StudioAction];tooltip.hidden=false;
      const rect=mount.getBoundingClientRect();tooltip.style.left=`${Math.max(4,Math.min(rect.width-155,event.clientX-rect.left+14))}px`;tooltip.style.top=`${Math.max(4,event.clientY-rect.top-42)}px`;canvas.style.cursor="pointer";
    }
  },{signal:events.signal});
  canvas.addEventListener("pointerup",event=>{const click=down&&!down.moved;down=undefined;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(click) {const hit=pick(event);if(hit)onAction(hit.userData.action);}},{signal:events.signal});
  canvas.addEventListener("pointercancel",()=>{down=undefined;clearHover();},{signal:events.signal});
  canvas.addEventListener("pointerleave",clearHover,{signal:events.signal});
  canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();failed=true;mount.dataset.renderActive="false";cancelAnimationFrame(frame);frame=0;motion?.resolve();motion=undefined;canvas.hidden=true;onFailure();},{signal:events.signal});
  setRoomCamera();resize();
  return {
    setActive(value:boolean) {const wasActive=active;active=value;mount.dataset.renderActive=String(value&&!failed);if(!value) {cancelAnimationFrame(frame);frame=0;chairFrameTime=undefined;clearHover();down=undefined;if(wasActive&&!failed&&!destroyed)renderer.render(scene,camera);}else requestDraw();},
    spinChair(reducedMotion=false) {
      if(failed||destroyed||chairElapsed!==undefined)return;
      if(reducedMotion) {chair.rotation.y=0;requestDraw();return;}
      for(const caster of casters)caster.startAngle=caster.group.rotation.y;
      chairElapsed=0;chairFrameTime=undefined;clearHover();requestDraw();
    },
    setLighting(light:ReturnType<typeof studioLighting>) {
      sun.intensity=0.3+2.9*light.daylight;sun.color.setHex(light.sun);
      ambient.intensity=0.75+1.85*light.daylight;lamp.intensity=7*(1-light.daylight);
      skyMaterial.color.setHex(light.sky);skyMaterial.emissive.setHex(light.sky);requestDraw();
    },
    moveToSurface(target:"computer"|"canvas",enter:boolean,duration:number,update:(progress:number)=>void) {
      motion?.resolve();zoomed=enter;
      clearHover();
      const surface=target==="computer"?computerSurface:canvasSurface;
      const view=surfaceView(surface);
      if(!enter) {camera.position.copy(view.position);currentLook.copy(view.look);}
      const to=enter?view.position:roomPosition(),lookTo=enter?view.look:focus;
      if(!duration||failed) {camera.position.copy(to);currentLook.copy(lookTo);camera.lookAt(currentLook);requestDraw();return Promise.resolve();}
      camera.lookAt(currentLook);camera.updateMatrixWorld();update(enter?0:1);
      return new Promise<void>(resolve=>{motion={start:performance.now(),duration,from:camera.position.clone(),to:to.clone(),lookFrom:currentLook.clone(),lookTo:lookTo.clone(),enter,update,resolve};requestDraw();});
    },
    cancelTransition() {motion?.resolve();motion=undefined;zoomed=false;setRoomCamera();requestDraw();},
    dispose() {destroyed=true;cancelAnimationFrame(frame);motion?.resolve();events.abort();resizeObserver.disconnect();outline.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();canvas.remove();},
  };
}
