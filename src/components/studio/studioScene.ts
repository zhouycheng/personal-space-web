import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { chairTurn } from "./chairMotion";
import { ACTION_LABELS, type StudioAction } from "./studioState";
import type { studioLighting } from "./studioTime";
import { smooth, surfaceDistance, surfacePhases, wheelZoom, clampRoomZoom, clampRoomAngle, clampRoomElevation, roomCameraStep, DEFAULT_ROOM_VIEW, ROOM_ZOOM_MAX } from "./studioMotion";
import { clockText } from "./studioTime";
import { stepRoomView, type RoomView, type RoomViewAction } from "./studioMotion";
import { StudioFailure, studioFailure } from "./studioFailure";

export type StudioScene = ReturnType<typeof createStudioScene>;

export function createStudioScene(mount: HTMLElement, onAction: (action: StudioAction) => void, onFailure: (error:StudioFailure) => void, onViewChange: (view:RoomView)=>void = ()=>{}, onReady:()=>void = ()=>{}, lightweight=false) {
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
  const ray = new THREE.Raycaster();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = true;
  let pointerEnabled = true;
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
  let hovering: THREE.Group | undefined;
  let down: { pointerId:number; x: number; y: number; lastX:number; lastY:number; moved: boolean } | undefined;
  let motion: { start: number; duration: number; sample: (progress:number) => void; enter: boolean; resolve: () => void } | undefined;
  const highlighted: { mesh:THREE.Mesh; original:THREE.Material|THREE.Material[]; glow:THREE.Material|THREE.Material[] }[]=[];
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
  // Hollow cabinet: the drawer boxes can actually leave their compartments.
  for(const x of [-1.59,-0.91]) box(room,[0.04,1.28,1.2],[x,0.65,-1.3],furnitureFrame);
  box(room,[0.64,1.28,0.04],[-1.25,0.65,-1.88],furnitureFrame);
  for(const y of [0.03,0.47,0.87,1.27]) box(room,[0.64,0.025,1.16],[-1.25,y,-1.28],furnitureFrame);
  const drawerActions = ["drawer-top","drawer-middle","drawer-bottom"] as const;
  const drawers = drawerActions.map((action,index) => {
    const group=hotspot(action);group.position.set(-1.25,1.07-index*0.4,-0.68);
    rounded(group,[0.65,0.36,0.045],[0,0,0],upholstery,0.012);
    box(group,[0.59,0.025,1.02],[0,-0.16,-0.53],wood);
    for(const x of [-0.285,0.285]) {
      box(group,[0.025,0.27,1.02],[x,-0.025,-0.53],wood);
      box(group,[0.012,0.028,0.9],[x*1.06,-0.07,-0.51],brass);
    }
    box(group,[0.59,0.27,0.025],[0,-0.025,-1.03],wood);
    for(const x of [-0.09,0.09]) box(group,[0.025,0.025,0.055],[x,0.07,0.046],brass);
    rounded(group,[0.24,0.027,0.025],[0,0.07,0.073],brass,0.01);
    return {action,group,open:false,from:0,to:0,elapsed:0,frameTime:undefined as number|undefined,moving:false};
  });
  const diary=new THREE.Group();drawers[0].group.add(diary);diary.userData.action="diary";
  diary.position.set(0,-0.105,-0.33);diary.rotation.y=-0.08;
  const leather=material(0x70432d,0.93);
  rounded(diary,[0.39,0.038,0.47],[0,0,0],paper,0.008);
  for(const y of [-0.026,0.026]) rounded(diary,[0.41,0.016,0.49],[0,y,0],leather,0.008);
  rounded(diary,[0.03,0.065,0.49],[-0.2,0,0],leather,0.008);
  for(const y of [-0.01,0,0.01]) box(diary,[0.375,0.002,0.002],[0.01,y,0.236],upholstery);
  box(diary,[0.018,0.003,0.53],[0.14,0.036,0.01],charcoal);
  const diaryTitle=label(diary,"JOURNAL",0.28,0.1,[-0.02,0.035,-0.065],"#70432d","#e7c88d",0.3);diaryTitle.rotation.x=-Math.PI/2;
  box(diary,[0.03,0.004,0.055],[0.06,-0.012,0.263],brass);
  // 2023 16-inch MacBook Pro: 35.57 × 24.81 cm footprint, space grey.
  // Stylized at room scale; the lid, keyboard and trackpad belong to one hotspot.
  const computer = hotspot("computer");
  const aluminum=material(0x8c9198,0.4);aluminum.metalness=0.55;
  const keycap=material(0x22262b), rubber=material(0x202523), chrome=material(0x999f9c,0.3);chrome.metalness=0.65;
  rounded(computer,[1.6,0.06,1.116],[-0.2,1.47,-1.32],aluminum,0.028);
  rounded(computer,[1.05,0.012,0.45],[-0.2,1.5,-1.46],keycap,0.02);
  const keyboardImage=document.createElement("canvas");keyboardImage.width=1536;keyboardImage.height=672;
  const keys=keyboardImage.getContext("2d")!;keys.fillStyle="#d4d8da";keys.textAlign="center";keys.textBaseline="middle";
  const rows=["esc F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 ●","` 1 2 3 4 5 6 7 8 9 0 - = delete","tab Q W E R T Y U I O P [ ] \\","caps A S D F G H J K L ; ' return","shift Z X C V B N M , . / shift","fn ctrl opt cmd space cmd opt ← ↕ →"];
  const keyWidth:Record<string,number>={delete:1.5,tab:1.4,caps:1.7,return:1.7,shift:2.1,space:5,cmd:1.2};
  rows.forEach((row,index)=>{
    const names=row.split(" "),unit=1.01/names.reduce((sum,name)=>sum+(keyWidth[name]??1),0);
    let left=-0.705;
    for(const name of names) {
      const width=unit*(keyWidth[name]??1),x=left+width/2,z=-1.662+index*0.075;
      const addKey=(text:string,atZ:number,depth:number)=>{
        rounded(computer,[width-0.009,0.007,depth],[x,1.511,atZ],keycap,0.003);
        keys.font=`500 ${text.length>1?22:32}px sans-serif`;
        if(text!=="space")keys.fillText(text,(x+0.725)/1.05*1536,(atZ+1.687)/0.45*672);
      };
      if(name==="↕") {addKey("↑",z-0.016,0.026);addKey("↓",z+0.016,0.026);}
      else addKey(name,z,index===0?0.039:0.06);
      left+=width;
    }
  });
  const keyboardTexture=new THREE.CanvasTexture(keyboardImage);keyboardTexture.colorSpace=THREE.SRGBColorSpace;keyboardTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.add(keyboardTexture);
  const legendsMaterial=new THREE.MeshBasicMaterial({map:keyboardTexture,transparent:true,depthWrite:false});materials.add(legendsMaterial);
  const legends=mesh(computer,new THREE.PlaneGeometry(1.05,0.45),legendsMaterial,-0.2,1.518,-1.462);legends.rotation.x=-Math.PI/2;legends.castShadow=false;
  rounded(computer,[0.69,0.006,0.31],[-0.2,1.502,-1.019],keycap,0.019);
  rounded(computer,[0.678,0.006,0.298],[-0.2,1.505,-1.019],aluminum,0.017);
  const speakerImage=document.createElement("canvas");speakerImage.width=64;speakerImage.height=256;
  const speakerCtx=speakerImage.getContext("2d")!;speakerCtx.fillStyle="#30343a";
  for(let x=7;x<64;x+=10)for(let y=5;y<256;y+=10){speakerCtx.beginPath();speakerCtx.arc(x,y,1.6,0,Math.PI*2);speakerCtx.fill();}
  const speakerTexture=new THREE.CanvasTexture(speakerImage);textures.add(speakerTexture);
  const speakerMaterial=new THREE.MeshStandardMaterial({map:speakerTexture,transparent:true,depthWrite:false,roughness:0.6});materials.add(speakerMaterial);
  for(const x of [-0.9,0.5]) {const speaker=mesh(computer,new THREE.PlaneGeometry(0.11,0.4),speakerMaterial,x,1.504,-1.48);speaker.rotation.x=-Math.PI/2;speaker.castShadow=false;}
  box(computer,[0.23,0.013,0.009],[-0.2,1.479,-0.758],charcoal);
  for(const [side,ports] of [[-1,[-1.7,-1.53,-1.28]],[1,[-1.7,-1.49,-1.25]]] as const) for(const [index,z] of ports.entries()) {
    const width=side===1&&index===1?0.12:0.07;
    rounded(computer,[0.01,0.024,width+0.01],[-0.2+side*0.8,1.47,z],chrome,0.003);
    rounded(computer,[0.011,0.017,width],[-0.2+side*0.802,1.47,z],keycap,0.003);
    if(index!==1)box(computer,[0.012,0.004,width*0.65],[-0.2+side*0.803,1.469,z],aluminum);
  }
  const lid=new THREE.Group();computer.add(lid);lid.position.set(-0.2,1.505,-1.84);lid.rotation.x=-0.23;lid.scale.set(1.127,1.127,1);
  rounded(lid,[1.42,0.91,0.035],[0,0.455,0],aluminum,0.017);
  rounded(lid,[1.38,0.873,0.011],[0,0.455,0.022],keycap,0.005);
  const computerSurface=label(lid,"Justin OS",1.31,0.81,[0,0.457,0.029]);
  rounded(lid,[0.18,0.041,0.007],[0,0.851,0.033],keycap,0.003);
  mesh(lid,new THREE.SphereGeometry(0.006,8,6),chrome,0,0.851,0.038);
  const hinge=cylinder(computer,0.027,1.32,[-0.2,1.5,-1.84],keycap);hinge.rotation.z=Math.PI/2;
  for(const x of [-0.83,0.43]) {const collar=cylinder(computer,0.029,0.08,[x,1.5,-1.84],aluminum);collar.rotation.z=Math.PI/2;}
  rounded(lid,[1.36,0.012,0.008],[0,0.03,0.031],rubber,0.003);
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

  // Open metal trays with thin folder covers, paper edges and index tabs.
  const library=hotspot("works");
  for(const x of [-1.57,-0.93]) for(const z of [-1.84,-1.48]) cylinder(library,0.012,0.55,[x,1.705,z],charcoal);
  for(let row=0;row<3;row++) {
    const y=1.46+row*0.18;
    rounded(library,[0.69,0.018,0.46],[-1.25,y,-1.65],charcoal,0.008);
    for(const x of [-1.58,-0.92]) box(library,[0.018,0.065,0.46],[x,y+0.032,-1.65],charcoal);
    box(library,[0.66,0.065,0.018],[-1.25,y+0.032,-1.872],charcoal);
    const folder=new THREE.Group();library.add(folder);folder.position.set(-1.25,y+0.026,-1.63);folder.rotation.y=(row-1)*0.045;
    const cover=row===1?blue:material(row===0?0xc8ab7b:0xb8bdc7);
    rounded(folder,[0.58,0.009,0.37],[0,0,0],cover,0.004);
    for(let page=0;page<4;page++) box(folder,[0.54,0.004,0.338],[page%2*0.003,0.008+page*0.005,0],paper);
    const topCover=rounded(folder,[0.58,0.009,0.37],[0,0.032,0],cover,0.004);topCover.rotation.z=-0.025;
    box(folder,[0.014,0.034,0.37],[-0.283,0.016,0],cover);
    rounded(folder,[0.145,0.01,0.045],[-0.16+row*0.14,0.032,0.197],cover,0.004);
    const tabLabel=label(folder,["PROJECTS","SELECTED","ARCHIVE"][row],0.32,0.065,[0.035,0.043,0.09],row===1?"#002fa7":row===0?"#c8ab7b":"#b8bdc7",row===1?"#fff9e9":"#303b39",0.4);tabLabel.rotation.x=-Math.PI/2;
  }
  const mug=new THREE.Group();room.add(mug);mug.position.set(-1.1,1.448,-0.94);mug.userData.label="一杯咖啡";
  const ceramic=material(0xeee4d1,0.24),coffee=material(0x382015,0.16);
  mesh(mug,new THREE.CylinderGeometry(0.15,0.15,0.014,48),material(0x98714b),0,-0.011,0);
  const cupProfile=[[0,0],[0.066,0],[0.079,0.014],[0.097,0.18],[0.096,0.195],[0.089,0.198],[0.083,0.183],[0.068,0.032],[0,0.032]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(mug,new THREE.LatheGeometry(cupProfile,40),ceramic,0,0,0);
  const handle=mesh(mug,new THREE.TorusGeometry(0.058,0.015,12,32),ceramic,0.105,0.113,0);handle.scale.x=0.83;
  for(const y of [0.065,0.16]) {const join=mesh(mug,new THREE.SphereGeometry(0.023,12,8),ceramic,0.083,y,0);join.scale.set(1,0.75,0.8);}
  const rim=mesh(mug,new THREE.TorusGeometry(0.091,0.005,10,48),ceramic,0,0.193,0);rim.rotation.x=Math.PI/2;
  const liquid=mesh(mug,new THREE.CircleGeometry(0.082,48),coffee,0,0.165,0);liquid.rotation.x=-Math.PI/2;liquid.castShadow=false;
  const crema=mesh(mug,new THREE.TorusGeometry(0.077,0.002,6,40),material(0xaf7b45),0,0.167,0);crema.rotation.x=Math.PI/2;
  const foam=material(0xb58a59,0.6);
  for(let i=0;i<8;i++) {const a=i*0.23,bubble=mesh(mug,new THREE.CircleGeometry(0.002+i%3*0.0008,8),foam,Math.cos(a)*0.071,0.168,Math.sin(a)*0.071);bubble.rotation.x=-Math.PI/2;bubble.castShadow=false;}
  const steam=new THREE.Group();mug.add(steam);steam.visible=false;
  const steamImage=document.createElement("canvas");steamImage.width=64;steamImage.height=64;
  const steamCtx=steamImage.getContext("2d")!,gradient=steamCtx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,"rgba(255,249,235,0.7)");gradient.addColorStop(0.45,"rgba(255,249,235,0.3)");gradient.addColorStop(1,"rgba(255,249,235,0)");
  steamCtx.fillStyle=gradient;steamCtx.fillRect(0,0,64,64);
  const steamTexture=new THREE.CanvasTexture(steamImage);steamTexture.colorSpace=THREE.SRGBColorSpace;textures.add(steamTexture);
  for(let i=0;i<7;i++) {
    const mat=new THREE.SpriteMaterial({map:steamTexture,transparent:true,depthWrite:false,toneMapped:false,opacity:0});materials.add(mat);
    const puff=new THREE.Sprite(mat);puff.raycast=()=>{};steam.add(puff);
  }
  let steamElapsed=0,steamFrameTime:number|undefined;

  // Angled desktop clock: one reusable texture, sourced from the visitor's clock.
  const deskClock=hotspot("clock");deskClock.position.set(0.67,1.572,-1.83);deskClock.rotation.y=-0.12;
  rounded(deskClock,[0.61,0.27,0.15],[0,0,0],charcoal,0.025);
  const clockFace=label(deskClock,"",0.55,0.21,[0,0,0.079],"#101d1d","#b5edc7",0.63);
  const clockTexture=(clockFace.material as THREE.MeshBasicMaterial).map!;
  const clockImage=clockTexture.image as HTMLCanvasElement;
  let displayedTime="";
  let clockDate=new Date(),showDate=false;

  // Articulated task lamp with an open shade and a downward, shadow-casting cone.
  const lampModel=hotspot("lamp");lampModel.userData.label="关闭台灯";
  const base=new THREE.Vector3(1.4,1.49,-1.84),elbow=new THREE.Vector3(1.53,2.02,-1.86),head=new THREE.Vector3(1.09,2.35,-1.64);
  cylinder(lampModel,0.18,0.065,[base.x,1.467,base.z],charcoal);
  cylinder(lampModel,0.155,0.013,[base.x,1.506,base.z],charcoal);
  cylinder(lampModel,0.025,0.014,[base.x-0.065,1.52,base.z+0.07],brass);
  for(const [a,b] of [[base,elbow],[elbow,head]]) {
    for(const offset of [-0.034,0.034]) {
      const arm=cylinder(lampModel,0.014,a.distanceTo(b),a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0,0,offset)).toArray(),charcoal);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    }
  }
  for(const point of [base,elbow,head]) {
    const joint=cylinder(lampModel,0.047,0.11,point.toArray(),charcoal);joint.rotation.x=Math.PI/2;
    for(const side of [-1,1]) {
      const bolt=cylinder(lampModel,0.023,0.009,[point.x,point.y,point.z+side*0.06],brass);bolt.rotation.x=Math.PI/2;
      box(lampModel,[0.024,0.004,0.002],[point.x,point.y,point.z+side*0.065],charcoal);
    }
  }
  const cord=new THREE.CatmullRomCurve3([new THREE.Vector3(1.45,1.515,-1.93),new THREE.Vector3(1.56,1.447,-1.97),new THREE.Vector3(1.68,1.443,-1.9)]);
  mesh(lampModel,new THREE.TubeGeometry(cord,16,0.008,6,false),charcoal,0,0,0);
  const lampTarget=new THREE.Object3D();lampTarget.position.set(0.65,1.43,-1.02);scene.add(lampTarget);
  const shade=new THREE.Group();lampModel.add(shade);shade.position.copy(head);
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),lampTarget.position.clone().sub(head).normalize());
  // Closed lathed shell includes the top, thick rolled lip and inner wall.
  const shadeMaterial=material(0x59645c,0.38);
  const shadeProfile=[[0,-0.045],[0.055,-0.045],[0.075,-0.065],[0.19,-0.22],[0.203,-0.244],[0.218,-0.244],[0.22,-0.229],[0.09,-0.04],[0.063,-0.018],[0.063,0.005],[0,0.005]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(shade,new THREE.LatheGeometry(shadeProfile,48),shadeMaterial,0,-0.065,0);
  cylinder(shade,0.025,0.07,[0,-0.03,0],brass);
  const diffuserMaterial=material(0xffe3aa,0.5);diffuserMaterial.emissive.setHex(0xffce87);diffuserMaterial.emissiveIntensity=1.5;
  const diffuser=mesh(shade,new THREE.CircleGeometry(0.182,40),diffuserMaterial,0,-0.286,0);diffuser.rotation.x=Math.PI/2;diffuser.castShadow=false;
  let lampOn=true,lampPower=2;
  const lamp=new THREE.SpotLight(0xffdfb0,0,5,Math.PI/3.5,0.72,2);
  lamp.position.copy(new THREE.Vector3(0,-0.315,0).applyQuaternion(shade.quaternion).add(head));lamp.target=lampTarget;
  lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=0.05;lamp.shadow.camera.far=5;
  lamp.shadow.bias=-0.0002;lamp.shadow.normalBias=0.008;scene.add(lamp);
  const ambient=new THREE.HemisphereLight(0xfff6e5,0x746b51,2.6);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffedce,3.2);sun.position.set(-3,7,2.5);sun.castShadow=true;
  cleanup.push(()=>{sun.shadow.map?.dispose();lamp.shadow.map?.dispose();});
  sun.target.position.set(0,0,-0.8);scene.add(sun.target);
  sun.shadow.radius=12;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-3.8;sun.shadow.camera.right=3.8;sun.shadow.camera.top=3.8;sun.shadow.camera.bottom=-3.8;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=16;sun.shadow.normalBias=0.012;sun.shadow.bias=-0.0001;scene.add(sun);

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
    if(!render())return;
    if(active&&!frame&&(motion||cameraMoving()||steamActive||chairElapsed!==undefined||drawers.some(drawer=>drawer.moving))) frame=requestAnimationFrame(draw);
  }
  function requestDraw() {if(active&&!frame&&!destroyed&&!failed) frame=requestAnimationFrame(draw);}
  function fail(error:StudioFailure) {
    if(destroyed||failed)return;
    failed=true;ready=false;clearHover();cancelAnimationFrame(frame);frame=0;
    mount.dataset.renderActive="false";mount.dataset.steamActive="false";
    // Three.js invalidates GPU handles and rebuilds them on restore; keep the
    // CPU-side geometry/material/texture objects alive for that re-upload.
    motion?.resolve();motion=undefined;canvas.hidden=true;onFailure(error);
  }
  function render() {
    if(destroyed||failed)return false;
    try {
      renderer.render(scene,camera);
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
    clearHover();if(!zoomed&&!motion)setRoomCamera();requestDraw();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  cleanup.push(()=>resizeObserver.disconnect());
  function clearHover() {
    for(const item of highlighted) {
      item.mesh.material=item.original;
      for(const m of [item.glow].flat())m.dispose();
    }
    if(highlighted.length)requestDraw();
    highlighted.length=0;
    hovering=undefined;tooltip.hidden=true;canvas.style.cursor="grab";
  }
  function highlight(group:THREE.Group|undefined) {
    hovering=group;
    group?.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const original=object.material;
      const glowMaterial=(m:THREE.Material)=>{
        const glow=m.clone();
        if(glow instanceof THREE.MeshStandardMaterial) {glow.emissive.setHex(0xe9f1ff);glow.emissiveIntensity=0.12;}
        return glow;
      };
      const glow=Array.isArray(original)?original.map(glowMaterial):glowMaterial(original);
      highlighted.push({mesh:object,original,glow});object.material=glow;
    });
    requestDraw();
  }
  function pick(event:PointerEvent) {
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObjects(room.children,true)[0];
    let object: THREE.Object3D | null=hit?.object ?? null;
    while(object && !object.userData.action&&!object.userData.label)object=object.parent;
    return (object??undefined) as THREE.Group | undefined;
  }
  canvas.addEventListener("wheel",event=>{
    if(!pointerEnabled||!roomInteractive()||event.ctrlKey||event.metaKey||!event.deltaY)return;
    if(down)down.moved=true;
    event.preventDefault();changeZoom(wheelZoom(targetZoom,event.deltaY,event.deltaMode,mount.clientHeight));
  },{passive:false,signal:events.signal});
  canvas.addEventListener("pointerdown",event=>{if(!pointerEnabled||!roomInteractive()||event.button!==0)return;clearHover();highlight(pick(event));down={pointerId:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);}, {signal:events.signal});
  canvas.addEventListener("pointermove",event=>{
    if(!pointerEnabled||!roomInteractive())return;
    if(down) {
      if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)down.moved=true;
      if(down.moved) {
        targetAngle=clampRoomAngle(targetAngle-(event.clientX-down.lastX)*0.0025);targetElevation=clampRoomElevation(targetElevation+(event.clientY-down.lastY)*0.0018);
        down.lastX=event.clientX;down.lastY=event.clientY;requestCamera();
      }
      return;
    }
    const hit=pick(event);
    if(hit!==hovering) {clearHover();highlight(hit);}
    if(hovering) {
      tooltip.textContent=hovering.userData.label??ACTION_LABELS[hovering.userData.action as StudioAction];tooltip.hidden=false;
      const rect=mount.getBoundingClientRect();tooltip.style.left=`${Math.max(8,Math.min(rect.width-tooltip.offsetWidth-8,event.clientX-rect.left+16))}px`;tooltip.style.top=`${Math.max(8,event.clientY-rect.top-34)}px`;canvas.style.cursor=hovering.userData.action?"pointer":"help";
    }
  },{signal:events.signal});
  canvas.addEventListener("pointerup",event=>{const click=pointerEnabled&&roomInteractive()&&down&&!down.moved;down=undefined;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(event.pointerType!=="mouse")clearHover();if(click) {const hit=pick(event);if(hit?.userData.action) {clearHover();onAction(hit.userData.action);}}},{signal:events.signal});
  canvas.addEventListener("pointercancel",()=>{down=undefined;clearHover();},{signal:events.signal});
  canvas.addEventListener("pointerleave",()=>clearHover(),{signal:events.signal});
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
    snapshot() {return {view:{zoom:targetZoom,angle:targetAngle,elevation:targetElevation},lampOn,showDate,drawers:drawers.map(drawer=>drawer.open)};},
    restore(snapshot:{view:RoomView;lampOn:boolean;showDate:boolean;drawers:boolean[]}) {
      roomZoom=targetZoom=snapshot.view.zoom;angle=targetAngle=snapshot.view.angle;elevation=targetElevation=snapshot.view.elevation;
      if(lampOn!==snapshot.lampOn)this.toggleLamp();
      if(showDate!==snapshot.showDate)this.toggleClock();
      drawers.forEach((drawer,index)=>{if(drawer.open!==snapshot.drawers[index])this.toggleDrawer(drawer.action);drawer.moving=false;drawer.group.position.z=-0.68+drawer.to;});
      setRoomCamera();onViewChange(snapshot.view);requestDraw();
    },
    setPointerEnabled(value:boolean) {
      pointerEnabled=value;
      if(!value) {
        if(down&&canvas.hasPointerCapture(down.pointerId))canvas.releasePointerCapture(down.pointerId);
        down=undefined;clearHover();stopCamera();requestDraw();
      }
    },
    setActive(value:boolean) {const wasActive=active;active=value;mount.dataset.renderActive=String(value&&!failed);if(!value) {stopCamera();steamFrameTime=undefined;steam.visible=false;mount.dataset.steamActive="false";cancelAnimationFrame(frame);frame=0;chairFrameTime=undefined;drawers.forEach(drawer=>drawer.frameTime=undefined);clearHover();down=undefined;if(!zoomed&&!motion)setRoomCamera();if(wasActive&&!failed&&!destroyed)render();}else requestDraw();},
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
      ambient.intensity=1.15+1.05*light.daylight;lampPower=2.8*(1-light.daylight)+1.2;lamp.intensity=lampOn?lampPower:0;
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
    cancelTransition() {stopCamera();clearHover();motion?.resolve();motion=undefined;zoomed=false;setRoomCamera();requestDraw();},
    dispose() {if(destroyed)return;destroyed=true;mount.dataset.renderActive="false";mount.dataset.steamActive="false";clearHover();motion?.resolve();cleanup.reverse().forEach(dispose=>dispose());},
  };
  } catch(error) {
    cleanup.reverse().forEach(dispose=>dispose());
    throw studioFailure(error,"initialization");
  }
}
