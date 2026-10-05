import * as THREE from 'three';
import {createWoolMaterial,addWoolPile} from './woolRug.ts';
import {createCampfireWood} from './campfireWood.ts';
import {createCampfireFlame} from './campfireFlame.ts';
import {createCampChair} from './campChair.ts';
import { mergeIndexed } from './indexedGeometry.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';
import { createWorkspaceMaterials } from './workspaceMaterials.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { islandLeisure as layout } from '../../../config/islandLeisure.ts';
import { breezeAt } from '../../../animation/studio/breeze.ts';
import { createLoungeShell,loungePanel } from './leisureGeometry.ts';
import { createDockBoat } from './dockBoat.ts';
import { createHurricaneLantern } from './hurricaneLantern.ts';
import { restControllerOnLounge } from './loungeSupport.ts';

/** Decorative beach objects; intentionally independent of the furniture picking tree. */
export function createIslandLeisure(p:StudioPrimitives,materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const group=new THREE.Group();group.name='island-leisure';
  const {timber,canvas,cork,end}=createWorkspaceMaterials(materials,textures);
  const wood=timber.clone();wood.color.set(0x8e7357);materials.add(wood);
  const stone=p.material(0x858580,.98),charcoal=p.material(0x25221f,1),metal=p.material(0x383c37,.6);
  const bark=createCampfireWood(materials,textures);
  const fabric=canvas.clone();fabric.color.set(0x67645f);fabric.bumpScale=.00012;materials.add(fabric);
  const seam=p.material(0x646058,.98);
  const sand=p.material(0x5a5145,1);sand.transparent=true;sand.depthWrite=false;
  const ashData=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot(x-31.5,y-31.5)/32,n=Math.sin(x*17+y*33)*.08;ashData[i]=ashData[i+1]=ashData[i+2]=255;ashData[i+3]=Math.round(Math.max(0,Math.min(.65,(1-r+n)*2))*255);}
  const ashMap=new THREE.DataTexture(ashData,64,64);ashMap.needsUpdate=true;textures.add(ashMap);sand.map=ashMap;
  function beam(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material) {
    const m=p.cylinder(parent,r,a.distanceTo(b),a.clone().add(b).multiplyScalar(.5).toArray(),mat,r*.88);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;
  }
  function root(name:string,x:number,z:number,angle=0) {const g=new THREE.Group();g.name=name;g.position.set(x,terrainHeight(x,z),z);g.rotation.y=angle;group.add(g);return g;}
  function piping(parent:THREE.Object3D,points:THREE.Vector3[],radius=.005,mat:THREE.Material=seam){
    return p.mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length*2),radius,6,false),mat,0,0,0);
  }
  const d=layout.dock,dock=new THREE.Group();dock.name='wooden-dock';group.add(dock);
  // Individual planks have small deterministic offsets; beams carry their weight.
  const n=24,step=(d.end-d.start)/n;
  const boards=[wood,...[0x9b8060,0x897256,0xa18a69].map(color=>{const m=wood.clone();m.color.set(color);materials.add(m);return m;})];
  for(let i=0;i<n;i++) {
    const board=p.rounded(dock,[step-.014,.095,d.width+(Math.sin(i*7)*.035)],[d.start+(i+.5)*step,d.deck+Math.sin(i*3)*.006,d.z],boards[i%4],.014);
    board.rotation.y=Math.sin(i*1.7)*.006;
    for(const side of [-1,1])p.cylinder(dock,.012,.003,[board.position.x,d.deck+.054,d.z+side*.52],metal);
  }
  const coil:THREE.Vector3[]=[];
  for(let i=0;i<=180;i++){const a=i/180*Math.PI*7,r=.09+i/180*.13;coil.push(new THREE.Vector3(d.end-.7+Math.cos(a)*r,d.deck+.073,d.z+.19+Math.sin(a)*r));}
  piping(dock,coil,.016,cork);
  for(const side of [-1,1]) {
    p.box(dock,[d.end-d.start+.12,.18,.14],[(d.start+d.end)/2,d.deck-.14,d.z+side*.5],wood);
    for(let i=0;i<5;i++) {
      const x=d.start+.15+i*(d.end-d.start-.3)/4,z=d.z+side*(d.width*.5+.035),bottom=terrainHeight(x,z)-.3,top=d.deck+.5;
      p.cylinder(dock,.095,top-bottom,[x,(top+bottom)/2,z],wood,.079);
      p.cylinder(dock,.084,.025,[x,top+.007,z],end);
      p.box(dock,[.24,.12,d.width+.3],[x,d.deck-.19,d.z],wood);
      // Rope wraps at the pile heads, rather than a fence across the landing.
      for(let j=0;j<3;j++){const ring=p.mesh(dock,new THREE.TorusGeometry(.09,.012,5,16),cork,x,top-.12-j*.025,z);ring.rotation.x=Math.PI/2;}
    }
  }
  const fire=root('stone-campfire',layout.campfire.x,layout.campfire.z);
  const ash=p.mesh(fire,new THREE.CircleGeometry(.83,48),sand,0,.015,0);ash.rotation.x=-Math.PI/2;
  const ember=p.material(0x542310);ember.emissive.set(0xed3903);ember.emissiveIntensity=1.4;
  for(let i=0;i<80;i++){const a=i*2.39996,r=.12+Math.sqrt(i/80)*.58;
    const coal=p.mesh(fire,new THREE.IcosahedronGeometry(.045+(i%3)*.014,1),i%4?charcoal:ember,Math.cos(a)*r,.035,Math.sin(a)*r);coal.scale.y=.45;}
  stone.vertexColors=true;
  for(let i=0;i<15;i++) {
    const a=i*Math.PI*2/15+Math.sin(i*4.7)*.06,r=.93+Math.sin(i*3.1)*.075;
    const geo=new THREE.SphereGeometry(1,36,24),pos=geo.attributes.position,colors=[];
    for(let j=0;j<pos.count;j++){
      const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j);
      const s=1+.065*Math.sin(x*5+y*3+i)*Math.sin(z*4-y*3)+.006*Math.sin(x*23+z*19)*Math.sin(y*17);
      pos.setXYZ(j,x*s,Math.max(-.7,y*s),z*s);
      const shade=.64+.22*(.5+.5*Math.sin(x*31+y*23+z*17))+.12*Math.sin(i*7);
      colors.push(shade,shade*.97,shade*.91);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const rock=p.mesh(fire,geo,stone,Math.cos(a)*r,.105,Math.sin(a)*r);
    rock.scale.set(.18+(i%4)*.024,.145+(i%3)*.035,.20+Math.sin(i*2)*.035);rock.rotation.y=i*1.73;
  }
  const logs=[[-.65,.11,-.25,.47,.12,-.39,.095],[-.55,.12,.42,.64,.16,.10,.11],[-.39,.20,-.60,.17,.29,.46,.10],[.49,.14,-.44,-.12,.36,.49,.085],[-.68,.09,.12,-.15,.13,.30,.065],[.19,.10,.52,.68,.09,.37,.075],[-.24,.30,-.34,.45,.37,.21,.08]];
  for(const [i,spec] of logs.entries()) {
    const a=new THREE.Vector3(...spec.slice(0,3) as [number,number,number]),b=new THREE.Vector3(...spec.slice(3,6) as [number,number,number]),radius=spec[6],length=a.distanceTo(b);
    const geo=new THREE.CylinderGeometry(radius*.76,radius,length,13,8),pos=geo.attributes.position;
    for(let j=0;j<pos.count;j++){const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j),angle=Math.atan2(z,x);const rough=1+.07*Math.sin(angle*7+y*37+i);pos.setXYZ(j,x*rough,y,z*rough);}
    geo.computeVertexNormals();const log=p.mesh(fire,geo,bark,...a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number]);log.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    for(const tip of [-1,1]){const cap=p.mesh(log,new THREE.CircleGeometry(radius*(tip>0?.75:.98),24),end,0,tip*(length/2+.001),0);cap.rotation.x=tip<0?Math.PI/2:-Math.PI/2;}
    for(let j=0;j<4;j++){const angle=j*2.4+i;
      piping(log,Array.from({length:5},(_,k)=>{const y=-length*.22+j*.026+k*length*.055,r=radius*(.88-y/length*.22);return new THREE.Vector3(Math.cos(angle+Math.sin(k*2+i)*.018)*r,y,Math.sin(angle+Math.sin(k*2+i)*.018)*r);}),.0013,ember);}
  }
  const flames=[createCampfireFlame(p,fire,materials)];
  const glow=new THREE.PointLight(0xffa044,3.2,7,1.7);glow.position.set(0,.65,0);fire.add(glow);

  function seat(x:number,z:number,angle:number) {
    const g=root('canvas-camp-chair',x,z,angle);
    createCampChair(p,g,wood,canvas,metal,seam);
  }
  for(const [dx,dz] of [[-1.85,.15],[1.95,-.35],[.4,1.75]]) {
    const x=layout.campfire.x+dx,z=layout.campfire.z+dz;seat(x,z,Math.atan2(-dx,-dz));
  }

  const game=root('beach-game-corner',layout.game.x,layout.game.z,layout.game.angle);
  const wool=createWoolMaterial(materials,0xa68d69);
  p.rounded(game,[2.05,.032,2.5],[0,.020,.2],wool,.014);
  addWoolPile(p,game,wool,2.05,2.5,(u,v)=>new THREE.Vector3(u,.037,v+.2));
  for(let i=0;i<68;i++)for(const edge of [-1,1])piping(game,[new THREE.Vector3(-1+i*.03,.033,.2+edge*1.245),new THREE.Vector3(-1+i*.03+.009*Math.sin(i),.024,.2+edge*(1.29+.016*Math.sin(i*4)))],.002,wool);
  const bag=p.mesh(game,createLoungeShell(),fabric,0,.025,-.50);bag.name='sewn-lounge-shell';
  for(const a of [-2.5,-.65,.68,2.4])piping(bag,Array.from({length:49},(_,i)=>loungePanel(a,.15+i/48*.51).multiplyScalar(1.004)),.003);
  piping(bag,Array.from({length:129},(_,i)=>loungePanel(i/128*Math.PI*2,.33).multiplyScalar(1.003)),.0035);
  // Pull tab and a recessed zipper at the back of the outer shell.
  piping(bag,[new THREE.Vector3(-.16,.19,-.79),new THREE.Vector3(0,.17,-.82),new THREE.Vector3(.16,.19,-.79)],.006,metal);
  p.rounded(bag,[.025,.06,.01],[.14,.18,-.795],metal,.004);
  const controller=new THREE.Group();controller.name='game-controller';
  const consoleBody=p.rounded(controller,[.25,.05,.12],[0,0,0],metal,.012);
  for(const side of [-1,1]){const grip=p.mesh(consoleBody,new THREE.SphereGeometry(1,20,12),canvas,side*.12,-.007,.03);grip.scale.set(.067,.033,.09);grip.rotation.y=side*.25;
    p.cylinder(consoleBody,.019,.012,[side*.063,.035,.024],metal);}
  for(let i=0;i<4;i++)p.cylinder(consoleBody,.006,.009,[.115+Math.cos(i*Math.PI/2)*.016,.04,-.025+Math.sin(i*Math.PI/2)*.016],metal);
  restControllerOnLounge(controller,bag,.20,-.12,.20);
  const crate=new THREE.Group();crate.position.set(0,0,1.12);crate.rotation.y=Math.PI;game.add(crate);
  // Separate planks, corner cleats and a fitted lid; the console is supported too.
  for(let i=0;i<4;i++){
    const y=.08+i*.113;
    for(const z of [-.29,.29])p.rounded(crate,[1.62,.105,.037],[0,y,z],boards[(i+1)%4],.009);
    for(const x of [-.81,.81])p.rounded(crate,[.037,.105,.55],[x,y,0],boards[i%4],.007);
  }
  for(let i=0;i<6;i++)p.rounded(crate,[.263,.044,.63],[-.68+i*.272,.5,0],boards[i%4],.008);
  for(const x of [-.67,.67]){
    for(const z of [-.317,.317])p.rounded(crate,[.073,.44,.037],[x,.25,z],timber,.007);
    p.rounded(crate,[.073,.028,.64],[x,.535,0],timber,.006);
    for(const z of [-.23,.23])p.rounded(crate,[.1,.04,.09],[x,.021,z],wood,.008);
    for(const y of [.08,.40]){const screw=p.cylinder(crate,.014,.011,[x,y,.341],metal);screw.rotation.x=Math.PI/2;}
  }
  for(const x of [-.42,.42]){
    p.rounded(crate,[.065,.09,.012],[x,.445,.32],metal,.004);
    p.rounded(crate,[.09,.052,.022],[x,.495,-.325],metal,.006);
  }
  piping(crate,[new THREE.Vector3(-.14,.30,.34),new THREE.Vector3(-.12,.24,.36),new THREE.Vector3(.12,.24,.36),new THREE.Vector3(.14,.30,.34)],.013,metal);
  p.rounded(crate,[.30,.028,.21],[0,.566,0],metal,.012);
  const stand=p.rounded(crate,[.045,.15,.04],[0,.645,-.01],metal,.009);stand.rotation.x=-.10;
  const displayFrame=metal.clone();displayFrame.color.set(0x20252a);displayFrame.metalness=.7;displayFrame.roughness=.32;materials.add(displayFrame);
  const tv=p.box(crate,[1.05,.65,.045],[0,.99,0],displayFrame);
  const screen=new THREE.MeshPhysicalMaterial({color:0x030505,roughness:.22,metalness:.08,clearcoat:1,clearcoatRoughness:.15});materials.add(screen);
  p.mesh(tv,new THREE.PlaneGeometry(.97,.57),screen,0,0,.026);
  for(let i=0;i<12;i++)p.rounded(tv,[.055,.006,.003],[-.34+i*.06,-.2,-.025],charcoal,.001);
  piping(crate,[new THREE.Vector3(.14,.8,-.036),new THREE.Vector3(.25,.6,-.12),new THREE.Vector3(.1,.54,-.27),new THREE.Vector3(-.55,.54,-.27)],.008,metal);
  // Upright white console with a recessed dark center and a low support foot.
  p.rounded(crate,[.14,.49,.29],[-.66,.76,0],metal,.035);
  for(const x of [-.745,-.575]){
    const geometry=new THREE.BoxGeometry(.024,.52,.33,1,20,12),v=geometry.attributes.position;
    for(let i=0;i<v.count;i++){const y=v.getY(i),z=v.getZ(i);v.setX(i,v.getX(i)+(x<-.66?-1:1)*(.017*Math.cos(y*7)+.027*(y+.26)/.52)+.008*Math.sin(z*10));}
    geometry.computeVertexNormals();p.mesh(crate,geometry,canvas,x,.80,0);
  }
  p.rounded(crate,[.28,.045,.35],[-.66,.53,0],metal,.018);
  const table=root('game-side-table',layout.game.x-1.18,2.68,layout.game.angle+.12);
  p.rounded(table,[.55,.065,.46],[0,.43,0],wood,.018);
  for(const x of [-.21,.21])for(const z of [-.17,.17])beam(table,new THREE.Vector3(x*1.08,.025,z*1.08),new THREE.Vector3(x,.415,z),.028,wood);
  for(const x of [-.21,.21])p.rounded(table,[.028,.06,.36],[x,.345,0],wood,.006);
  p.rounded(table,[.24,.055,.17],[0,.5,0],canvas,.009);
  const glass=new THREE.MeshPhysicalMaterial({color:0xf2f5ed,transparent:true,opacity:.14,depthWrite:false,roughness:.08,clearcoat:1,side:THREE.DoubleSide});materials.add(glass);
  const lampMetal=p.material(0x434a42,.42);lampMetal.metalness=.55;
  const lampBrass=p.material(0x9b8152,.36);lampBrass.metalness=.7;
  const wick=p.material(0xffd486);wick.emissive.set(0xffaa32);wick.emissiveIntensity=2;
  const core=new THREE.MeshBasicMaterial({color:0xfff1d7,toneMapped:false});materials.add(core);
  const lamp=createHurricaneLantern(p,{metal:lampMetal,brass:lampBrass,dark:charcoal,glass,wick,core});
  lamp.position.set(.02,.53,.04);lamp.scale.setScalar(.8);table.add(lamp);
  const gameLight=new THREE.PointLight(0xffcf91,2.6,4.3,1.5);gameLight.position.set(-.5,1.2,-.35);game.add(gameLight);
  const dockLights:THREE.PointLight[]=[];
  for(const x of [d.start+.5,d.end-.45]){
    const lantern=lamp.clone(true);lantern.position.set(x,d.deck+.07,d.z-d.width*.32);dock.add(lantern);
    const light=new THREE.PointLight(0xffc78b,1.3,3.1,1.5);light.position.copy(lantern.position).y+=.4;dock.add(light);dockLights.push(light);
  }
  // Keep the many deck fixings and chair joints from becoming separate draw calls.
  group.updateMatrixWorld(true);
  const batches=new Map<string,THREE.Mesh[]>();
  group.traverse(object=>{if(object instanceof THREE.Mesh&&object.material instanceof THREE.MeshStandardMaterial&&!object.material.transparent){
    const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const list=batches.get(key)??[];list.push(object);batches.set(key,list);
  }});
  for(const objects of batches.values()){
    const first=objects[0],material=first.material as THREE.Material;
    const merged=mergeIndexed(objects.map(object=>({geometry:object.geometry,matrix:object.matrixWorld})));
    if(merged){objects.forEach(object=>object.removeFromParent());const mesh=p.mesh(group,merged,material,0,0,0);mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;}
  }
  let daylight=1;
  const boat=createDockBoat(p,materials,textures);group.add(boat.group);
  return {group,boatInverse:boat.inverse,setWaterTime:boat.update,setLighting(value:number){daylight=value;wick.emissiveIntensity=1.1+(1-value)*.9;gameLight.intensity=.8+(1-value)*1.7;dockLights.forEach(light=>light.intensity=.35+(1-value)*1.3);},setWind(seconds:number){
    const gust=breezeAt(layout.campfire.x,layout.campfire.z,seconds);
    for(const flame of flames){(flame.material as THREE.ShaderMaterial).uniforms.time.value=seconds;flame.rotation.z=-gust*.0765;flame.rotation.x=gust*.0477;}
    glow.intensity=(2.4+(1-daylight)*1.8)*(1+.075*Math.sin(seconds*7.3)+.035*Math.sin(seconds*13.1));
  }};
}
