import * as THREE from "three";
import { workspaceAppearance as layout } from "../../../config/workspaceAppearance.ts";
import { createWorkspaceMaterials } from "./workspaceMaterials.ts";
import { journalAppearance } from "../../../config/journalAppearance.ts";
import type { StudioPrimitives } from "./studioPrimitives";
import { createWorkspaceChair } from './workspaceChair.ts';

export function createStudioFurniture(room: THREE.Group, primitives: StudioPrimitives, materials: Set<THREE.Material>, textures: Set<THREE.Texture>) {
  const { material, mesh, box, rounded, hotspot, label,
    brass,
     } = primitives;
  const {timber:wood,end}=createWorkspaceMaterials(materials,textures);
  const furnitureFrame=wood;
  // Ground and its received shadows belong to the island environment.
  
  // Work desk, drawers, keyboard, chair.
  for(let i=0;i<5;i++) {
    rounded(room,[layout.deskWidth,.16,.294],[0,layout.tabletop-.08,-1.3+(i-2)*.3],wood,.018);
    for(const x of [-1.748,1.748]) rounded(room,[.005,.128,.272],[x,layout.tabletop-.08,-1.3+(i-2)*.3],end,.002);
  }
  for(const z of [-1.9,-.7]) {
    rounded(room,[.15,1.27,.15],[1.51,.635,z],wood,.014);
    rounded(room,[.2,.13,1.37],[1.51,.24,-1.3],wood,.016);
  }
  rounded(room,[2.96,.14,.11],[0,1.19,-1.91],wood,.012);
  rounded(room,[2.9,.1,.1],[0,.3,-1.8],wood,.012);
  // Hollow cabinet: the drawer boxes can actually leave their compartments.
  for(const x of [-1.59,-0.91]) box(room,[0.04,1.28,1.2],[x,0.65,-1.3],furnitureFrame);
  box(room,[0.64,1.28,0.04],[-1.25,0.65,-1.88],furnitureFrame);
  for(const y of [0.03,0.47,0.87,1.27]) box(room,[0.64,0.025,1.16],[-1.25,y,-1.28],furnitureFrame);
  const drawerActions = ["drawer-top","drawer-middle","drawer-bottom"] as const;
  const drawers = drawerActions.map((action,index) => {
    const group=hotspot(action);group.position.set(-1.25,1.07-index*0.4,layout.drawerFront);
    rounded(group,[0.65,0.36,0.045],[0,0,0],wood,0.012);
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

  const {chair,chairSeat}=createWorkspaceChair(primitives,materials,textures);
  return { drawerActions, drawers, diary, chair, chairSeat };
}
