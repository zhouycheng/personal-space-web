import * as THREE from "three";
import { studioPalette as palette, paletteHex } from "../../../config/studioPalette";
import type { StudioSceneFile } from "../../../contracts/studio";
import type { StudioPrimitives } from "./studioPrimitives";

export function createStudioDevices(primitives: StudioPrimitives, studioFiles: readonly StudioSceneFile[], renderer: THREE.WebGLRenderer, materials: Set<THREE.Material>, geometries: Set<THREE.BufferGeometry>, textures: Set<THREE.Texture>) {
  const { material, mesh, box, cylinder, rounded, hotspot, label,
    paper, aluminum, keycap, rubber, chrome } = primitives;
  // 2023 16-inch MacBook Pro: 35.57 × 24.81 cm footprint, space grey.
  // Stylized at room scale; the lid, keyboard and trackpad belong to one hotspot.
  const computer = hotspot("computer");
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
  box(computer,[0.23,0.013,0.009],[-0.2,1.479,-0.758],material(0x303b39));
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

  // Flat iPad replaces the introduction folder and opens the personal canvas.
  const tablet=hotspot("canvas");tablet.position.set(1.04,1.45,-1.1);
  rounded(tablet,[0.78,0.035,0.58],[0,0,0],aluminum,0.025);
  rounded(tablet,[0.755,0.006,0.555],[0,0.02,0],keycap,0.024);
  const canvasSurface=label(tablet,"MY CANVAS",0.69,0.49,[0,0.024,0],"#fff9e9","#002fa7",0.16);
  canvasSurface.rotation.x=-Math.PI/2;
  cylinder(tablet,0.008,0.003,[0,0.025,-0.263],chrome);
  const pencil=cylinder(tablet,0.014,0.48,[0.43,0.005,0],paper);pencil.rotation.x=Math.PI/2;
  box(tablet,[0.004,0.012,0.055],[0.391,0,0],keycap);
  
  // Files rest on their lower edge; the manifest distinguishes folders from loose paper.
  const library=hotspot("works");
  library.position.set(-1.25,1.44,-1.68);
  library.userData.label=`文件夹 · ${studioFiles.length} 个文件`;
  const fileBox=material(palette.box,0.92);
  rounded(library,[0.68,0.028,0.5],[0,0,0],fileBox,0.009);
  rounded(library,[0.68,0.24,0.023],[0,0.12,0.24],fileBox,0.009);
  box(library,[0.68,0.7,0.023],[0,0.35,-0.24],fileBox);
  const side=new THREE.Shape();
  side.moveTo(-0.24,0);side.lineTo(0.24,0);side.lineTo(0.24,0.7);
  side.lineTo(0.10,0.7);side.lineTo(-0.24,0.24);side.closePath();
  for(const x of [-0.34,0.32]) {
    const wall=mesh(library,new THREE.ExtrudeGeometry(side,{depth:0.02,bevelEnabled:false}),fileBox,x,0,0);
    wall.rotation.y=Math.PI/2;
  }
  label(library,"FILES",0.22,0.06,[0,0.13,0.253],paletteHex(palette.box),"#45483e",0.5);
  const slot=0.58/Math.max(1,studioFiles.length);
  const fileLean=Math.min(0.025,slot*0.12);
  // The left wall's inner face is x=-0.32; lean into its 0.7-high rear support.
  let fileEdge=-0.32+(0.7-0.014)*Math.tan(fileLean);
  studioFiles.forEach((file,index)=>{
    const folder=new THREE.Group();library.add(folder);
    const thickness=Math.min(0.10,slot*0.65),height=0.76+(index%3)*0.045;
    const occupied=file.kind==="resume"?Math.min(0.012,slot*0.1):thickness+Math.min(0.009,slot*0.08);
    folder.position.set(fileEdge+occupied/2,0.014+occupied/2*Math.sin(fileLean),0);
    fileEdge+=occupied;
    folder.rotation.z=fileLean;
    if(file.kind==="resume") {
      // The sheet rests alongside the cover with only a slight outward bow.
      const sheetHeight=0.86,sheetWidth=0.40;
      folder.position.z=0.018;
      folder.rotation.y=-Math.min(0.018,slot*0.1);
      const sheet=label(folder,`${file.resume.name} · 简历`,sheetWidth,sheetHeight,[0,sheetHeight/2,0],"#fffdf5","#303b39",0.045);
      const geometry=new THREE.PlaneGeometry(sheetWidth,sheetHeight,8,16);
      geometry.rotateY(Math.PI/2);
      const positions=geometry.attributes.position;
      for(let vertex=0;vertex<positions.count;vertex++) {
        const t=(positions.getY(vertex)+sheetHeight/2)/sheetHeight;
        positions.setX(vertex,Math.min(0.012,slot*0.08)*t*(1-t));
      }
      geometry.computeVertexNormals();geometries.add(geometry);sheet.geometry=geometry;
      const sheetMaterial=new THREE.MeshStandardMaterial({map:(sheet.material as THREE.MeshBasicMaterial).map,side:THREE.DoubleSide,roughness:0.96});
      materials.add(sheetMaterial);sheet.material=sheetMaterial;
      const image=sheetMaterial.map!.image as HTMLCanvasElement;
      const ctx=image.getContext("2d")!;
      ctx.fillStyle="#fffdf5";ctx.fillRect(0,0,image.width,image.height);
      ctx.textAlign="left";ctx.fillStyle="#303b39";
      ctx.font="600 88px sans-serif";ctx.fillText(file.resume.name,100,235);
      ctx.font="38px sans-serif";ctx.fillStyle="#002fa7";ctx.fillText(file.resume.role,100,315);
      ctx.fillRect(100,365,100,6);
      file.resume.sections.forEach((section,index)=>{
        const y=490+index*290;
        ctx.fillStyle="#303b39";ctx.font="600 42px sans-serif";ctx.fillText(section.title,100,y);
        ctx.fillStyle="#c5c8be";
        for(let line=0;line<4;line++) ctx.fillRect(100,y+55+line*35,line===3?520:800,8);
      });
      sheetMaterial.map!.needsUpdate=true;
      return;
    }
    const color=index%2?(palette.accent):(palette.upholstery);
    const cover=material(color),edge=Math.min(0.006,thickness*0.08);
    for(const x of [-thickness/2,thickness/2]) box(folder,[edge,height,0.40],[x,height/2,0],cover);
    box(folder,[thickness,height,edge],[0,height/2,0.20],cover);
    box(folder,[thickness*0.85,height-0.025,0.37],[0,(height-0.025)/2,0],paper);
    for(let sheet=1;sheet<4;sheet++) box(folder,[edge/3,height-0.028,0.372],[-thickness*0.4+thickness*0.2*sheet,(height-0.028)/2,0],fileBox);
    const title=label(folder,file.title,0.35,thickness*0.8,[0,height-0.22,0.205],`#${color.toString(16).padStart(6,"0")}`,index%2?"#fff9e9":"#303b39",0.55);
    title.rotation.z=-Math.PI/2;
    rounded(folder,[thickness*0.8,0.05,0.04],[0,height+0.012,-0.12+index%3*0.08],cover,Math.min(0.004,edge));
  });
  return { computerSurface, canvasSurface };
}
