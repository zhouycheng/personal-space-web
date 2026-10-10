import * as THREE from 'three';
import type { StudioPrimitives } from './studioPrimitives';
import { workspaceAppearance } from '../../../config/workspaceAppearance.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';

/** Furniture geometry only. Audio state arrives through the scene port. */
export function createRecordPlayer(parent: THREE.Group, p: StudioPrimitives, timber: THREE.Material) {
  const group = new THREE.Group(); group.name = 'record-player-cabinet'; parent.add(group);
  const placement=workspaceAppearance.recordPlayer;
  const ground=terrainHeight(placement.x,placement.z);
  group.position.set(placement.x, ground, placement.z);group.rotation.y=placement.angle;
  const { rounded, box, mesh, material, chrome, rubber, brass } = p;
  const walnut = material(0x503728, .65), black = material(0x171b19, .4);
  const aluminum = material(0x939a93, .27); aluminum.metalness = .8;
  for (const x of [-.32, .32]) for (const z of [-.29, .29]) {
    const c=Math.cos(placement.angle),s=Math.sin(placement.angle);
    const foot=terrainHeight(placement.x+x*c+z*s,placement.z-x*s+z*c)-ground;
    rounded(group,[.075,.24-foot,.075],[x,(.24+foot)/2,z],walnut,.009);
  }
  for (const x of [-.38,.38]) rounded(group,[.06,.66,.7],[x,.55,0],timber,.009);
  for (const y of [.25,.52,.91]) rounded(group,[.82,.06,.74],[0,y,0],timber,.012);
  box(group,[.7,.63,.035],[0,.56,-.33],timber);
  rounded(group,[.68,.29,.035],[0,.715,.353],walnut,.008);
  rounded(group,[.2,.025,.035],[0,.72,.385],brass,.008);
  // A few sleeves in the open lower shelf give the cabinet a readable scale.
  for (let i=0;i<4;i++) box(group,[.022,.2,.22],[-.23+i*.037,.38,.03],material([0x586a5b,0xb3a285,0x303d42,0x957960][i]));
  const deck = new THREE.Group(); deck.position.y=.95; group.add(deck);
  for (const x of [-.28,.28]) for (const z of [-.23,.23]) p.cylinder(deck,.035,.045,[x,.012,z],rubber);
  rounded(deck,[.73,.085,.6],[0,.065,0],walnut,.022);
  rounded(deck,[.69,.008,.56],[0,.112,0],black,.01);
  const disc = new THREE.Group(); disc.position.set(-.105,.137,0); deck.add(disc);
  mesh(disc,new THREE.CylinderGeometry(.228,.228,.025,64),aluminum,0,0,0);
  mesh(disc,new THREE.CylinderGeometry(.216,.216,.008,64),black,0,.018,0);
  const groove = material(0x333a35,.48);
  for(let i=0;i<12;i++) {
    const ring=mesh(disc,new THREE.TorusGeometry(.087+i*.01,.0007,3,64),groove,0,.023,0);
    ring.rotation.x=Math.PI/2;ring.castShadow=false;
  }
  mesh(disc,new THREE.CylinderGeometry(.075,.075,.001,48),material(0x80917b),0,.023,0);
  const print=p.label(disc,'SIDE A',.085,.023,[0,.025,-.032],'#80917b','#f6f1dd',.55);print.rotation.x=-Math.PI/2;print.castShadow=false;
  p.cylinder(disc,.007,.024,[0,.025,0],chrome);
  // Pivot, counterweight, arm tube, cartridge and stylus remain separate from the platter.
  p.cylinder(deck,.035,.05,[.235,.145,-.19],aluminum);
  const arm = new THREE.Group();arm.position.set(.235,.176,-.19);deck.add(arm);
  p.cylinder(arm,.027,.045,[0,0,0],chrome);
  const tube=mesh(arm,new THREE.CylinderGeometry(.008,.008,.32,12),chrome,0,0,.1);tube.rotation.x=Math.PI/2;
  const weight=mesh(arm,new THREE.CylinderGeometry(.025,.025,.048,24),black,0,0,-.075);weight.rotation.x=Math.PI/2;
  rounded(arm,[.038,.019,.065],[0,-.009,.267],black,.005);
  box(arm,[.005,.015,.008],[0,-.026,.281],brass);
  p.cylinder(deck,.023,.018,[.265,.127,.216],aluminum);
  const indicator=material(0x65715f);indicator.emissive.set(0x80917b);
  mesh(deck,new THREE.SphereGeometry(.006,8,6),indicator,.215,.124,.217);
  let playing=false, previous:number|undefined;
  arm.rotation.x=-.1;
  return {
    setPlaying(value:boolean){playing=value;indicator.emissiveIntensity=value?.8:0;},
    pause(){previous=undefined;},
    tick(now:number,reduced:boolean) {
      const dt=previous===undefined?0:Math.min(50,Math.max(0,now-previous))/1000;previous=now;
      const target=playing?-.65:0, lift=playing?0:-.1;
      const moving=Math.abs(arm.rotation.y-target)>.001||Math.abs(arm.rotation.x-lift)>.001;
      const blend=reduced?1:1-Math.exp(-dt*9);
      arm.rotation.y=reduced?target:arm.rotation.y+(target-arm.rotation.y)*blend;
      arm.rotation.x=reduced?lift:arm.rotation.x+(lift-arm.rotation.x)*blend;
      if(playing&&!reduced)disc.rotation.y=(disc.rotation.y+dt*Math.PI/6)%(Math.PI*2);
      return {changed:moving||(playing&&!reduced),shadowChanged:moving,moving:!reduced&&(moving||playing)};
    },
  };
}
