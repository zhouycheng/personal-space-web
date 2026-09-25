import * as THREE from "three";
import { journalAppearance } from "../../../config/journalAppearance";
import type { StudioPrimitives } from "./studioPrimitives";

export function createStudioFurniture(scene: THREE.Scene, room: THREE.Group, primitives: StudioPrimitives, materials: Set<THREE.Material>, textures: Set<THREE.Texture>, renderer: THREE.WebGLRenderer) {
  const { material, mesh, box, cylinder, rounded, hotspot, label,
    wood, charcoal, brass, furnitureFrame, upholstery,
    chrome, rubber } = primitives;
  // Transparent shadow receiver: no visible floor slab or room enclosure.
  const shadowMaterial=new THREE.ShadowMaterial({color:0x242720,opacity:0.24});materials.add(shadowMaterial);
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
  diary.position.set(0,-0.105,-0.39);diary.rotation.y=-0.08;
  const leather=material(journalAppearance.cover,journalAppearance.roughness);
  rounded(diary,[0.39,0.038,0.47],[0,0,0],material(journalAppearance.edge),0.008);
  for(const y of [-0.026,0.026]) rounded(diary,[0.41,0.016,0.49],[0,y,0],leather,0.008);
  rounded(diary,[0.03,0.065,0.49],[-0.2,0,0],leather,0.008);
  for(const y of [-0.01,0,0.01]) box(diary,[0.375,0.002,0.002],[0.01,y,0.236],material(0xb9b1a2,0.95));
  const diaryTitle=label(diary,"JOURNAL",0.22,0.07,[0,0.035,-0.065],journalAppearance.coverCss,journalAppearance.titleCss,0.22);diaryTitle.rotation.x=-Math.PI/2;
  const diaryHitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});materials.add(diaryHitMaterial);
  const diaryHit=mesh(diary,new THREE.BoxGeometry(.49,.12,.57),diaryHitMaterial,0,.015,0);
  diaryHit.castShadow=false;diaryHit.receiveShadow=false;diaryHit.userData.hitProxy=true;

  // Whole-chair turn: casters align to the circular path and wheels roll along it.
  const chair=hotspot("chair");chair.position.set(-0.2,0,0.18);
  const seat=new THREE.Group();chair.add(seat);
  const casters: { group: THREE.Group; startAngle: number }[]=[];
  const chairWheels: { group: THREE.Group; pathRadius: number }[]=[];
  const chairFrame=material(0x34393b,0.65),chairFabric=material(0x292e30,0.96);
  cylinder(chair,0.09,0.28,[0,0.36,0],chairFrame);
  cylinder(chair,0.044,0.3,[0,0.6,0],chrome);
  rounded(seat,[0.56,0.08,0.5],[0,0.75,0],chairFrame,0.03);
  rounded(seat,[0.87,0.13,0.84],[0,0.855,0],chairFabric,0.065);
  
  // Cut-out woven mesh: open cells reveal the desk through the backrest.
  const weaveImage=document.createElement("canvas");weaveImage.width=16;weaveImage.height=16;
  const weave=weaveImage.getContext("2d")!;
  weave.clearRect(0,0,16,16);weave.fillStyle="#565b5d";
  weave.fillRect(0,0,3,16);weave.fillRect(0,0,16,2);
  const weaveTexture=new THREE.CanvasTexture(weaveImage);
  weaveTexture.colorSpace=THREE.SRGBColorSpace;
  weaveTexture.wrapS=weaveTexture.wrapT=THREE.RepeatWrapping;
  weaveTexture.repeat.set(27,34);weaveTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.add(weaveTexture);
  const meshFabric=new THREE.MeshStandardMaterial({map:weaveTexture,alphaTest:0.35,side:THREE.DoubleSide,roughness:0.95});
  materials.add(meshFabric);
  const back=new THREE.Group();seat.add(back);back.position.set(0,0.96,0.36);back.rotation.x=0.12;
  function chairTube(parent:THREE.Object3D,points:THREE.Vector3[],radius:number,closed=false) {
    return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),48,radius,8,closed),chairFrame,0,0,0);
  }
  function backPoint(u:number,v:number) {
    const width=0.69+0.10*Math.sin(Math.PI*v)-0.035*v;
    return new THREE.Vector3(u*width,0.03+v*0.67,0.02-0.09*Math.sin(Math.PI*v)+0.12*u*u);
  }
  const meshGeometry=new THREE.PlaneGeometry(1,1,24,28);
  const meshPositions=meshGeometry.attributes.position;
  for(let i=0;i<meshPositions.count;i++) {
    const point=backPoint(meshPositions.getX(i),meshPositions.getY(i)+0.5);
    meshPositions.setXYZ(i,point.x,point.y,point.z);
  }
  meshGeometry.computeVertexNormals();
  const backMesh=mesh(back,meshGeometry,meshFabric,0,0,0);
  // The perimeter and supports cast shadows; avoid a solid shadow from the mesh sheet.
  backMesh.castShadow=false;
  const perimeter:THREE.Vector3[]=[];
  for(let i=0;i<=12;i++)perimeter.push(backPoint(-0.5,i/12));
  for(let i=1;i<=8;i++)perimeter.push(backPoint(-0.5+i/8,1));
  for(let i=1;i<=12;i++)perimeter.push(backPoint(0.5,1-i/12));
  for(let i=1;i<8;i++)perimeter.push(backPoint(0.5-i/8,0));
  chairTube(back,perimeter,0.029,true);
  // A shallow lumbar band follows the same surface as the mesh and joins both rails.
  const lumbarGeometry=new THREE.BoxGeometry(1,0.11,0.022,32,4,1);
  const lumbarPositions=lumbarGeometry.attributes.position;
  for(let i=0;i<lumbarPositions.count;i++) {
    const u=lumbarPositions.getX(i);
    const taper=0.55+0.45*Math.cos(Math.PI*u);
    const v=0.31+lumbarPositions.getY(i)*taper/0.67;
    const point=backPoint(u,v);
    // Keep the front face immediately behind the mesh, without intersecting it.
    point.z+=0.017+lumbarPositions.getZ(i);
    lumbarPositions.setXYZ(i,point.x,point.y,point.z);
  }
  lumbarGeometry.computeVertexNormals();
  mesh(back,lumbarGeometry,chairFrame,0,0,0);
  // Twin lower mounts terminate at the bottom rim instead of protruding up the back.
  for(const u of [-0.34,0.34]) {
    const joint=backPoint(u,0);
    chairTube(back,[new THREE.Vector3(joint.x,-0.18,0.02),new THREE.Vector3(joint.x,-0.07,0.065),joint],0.025);
  }
  for(const x of [-0.5,0.5]) {
    rounded(seat,[0.047,0.34,0.09],[x,1.0,0.09],chairFrame,0.02);
    rounded(seat,[0.15,0.065,0.48],[x,1.19,0.015],chairFabric,0.03);
  }
  const lever=cylinder(seat,0.014,0.3,[0.31,0.75,0.19],chrome);lever.rotation.z=Math.PI/2;
  rounded(seat,[0.13,0.04,0.07],[0.48,0.75,0.19],chairFrame,0.015);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    const spoke=new THREE.Group();chair.add(spoke);spoke.rotation.y=a;
    const leg=rounded(spoke,[0.1,0.075,0.65],[0,0.24,0.31],chairFrame,0.035);leg.rotation.x=0.12;
    const caster=new THREE.Group();spoke.add(caster);caster.position.set(0,0,0.63);caster.rotation.y=0.25;
    casters.push({group:caster,startAngle:caster.rotation.y});
    cylinder(caster,0.025,0.1,[0,0.205,0],chrome);
    rounded(caster,[0.09,0.08,0.12],[0,0.17,0.025],chairFrame,0.02);
    for(const x of [-0.065,0.065]) {
      const rolling=new THREE.Group();caster.add(rolling);rolling.position.set(x,0.14,0.043);
      chairWheels.push({group:rolling,pathRadius:Math.hypot(0.63-x,0.043)});
      const wheel=cylinder(rolling,0.085,0.045,[0,0,0],rubber);wheel.rotation.z=Math.PI/2;
      const hub=cylinder(rolling,0.033,0.047,[0,0,0],chrome);hub.rotation.z=Math.PI/2;
      // Small hub mark makes the wheel's rolling motion readable at room scale.
      box(rolling,[0.049,0.012,0.045],[0,0.045,0],chrome);
    }
  }
  return { drawerActions, drawers, diary, chair, casters, chairWheels };
}
