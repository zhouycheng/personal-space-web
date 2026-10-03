import * as THREE from "three";
import { studioPalette as palette, paletteHex } from "../../../config/studioPalette.ts";
import type { StudioSceneFile } from "../../../contracts/studio";
import type { StudioPrimitives } from "./studioPrimitives";
import { createWorkspaceMaterials } from "./workspaceMaterials.ts";
export function createStudioFiles(primitives:StudioPrimitives,studioFiles:readonly StudioSceneFile[],materials:Set<THREE.Material>,geometries:Set<THREE.BufferGeometry>,textures:Set<THREE.Texture>) {
  const {hotspot,rounded,box,mesh,label,material,paper}=primitives;
  const {timber:fileBox}=createWorkspaceMaterials(materials,textures);
  // Files rest on their lower edge; the manifest distinguishes folders from loose paper.
  const library=hotspot("works");
  library.position.set(-2.22,0.085,-.95);
  library.userData.label=`文件木箱 · ${studioFiles.length} 个文件`;
  rounded(library,[.83,.09,.64],[0,-.035,0],fileBox,.012);
  for(const y of [.09,.25,.41]) {
    for(const z of [-.3,.3]) rounded(library,[.83,.145,.045],[0,y,z],fileBox,.009);
    for(const x of [-.394,.394]) rounded(library,[.045,.145,.56],[x,y,0],fileBox,.009);
  }
  for(const x of [-.35,.35]) for(const z of [-.255,.255]) rounded(library,[.055,.5,.055],[x,.23,z],fileBox,.008);
  label(library,"FILES",0.22,0.06,[0,0.25,0.325],paletteHex(palette.box),"#45483e",0.5);
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
      const sheetMaterial=new THREE.MeshStandardMaterial({map:(sheet.material as THREE.MeshStandardMaterial).map,side:THREE.DoubleSide,roughness:0.96});
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
  for(const x of [-.3,.3]) for(const y of [.06,.2]) {
    const bolt=mesh(library,new THREE.SphereGeometry(.012,8,6),primitives.brass,x,y,.327);bolt.scale.z=.3;
  }
}
