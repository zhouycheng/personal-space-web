import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { livingProps,livingPlanters,landingStones } from '../../../config/islandLiving.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { createHammockGeometry,hammockAnchors,hammockPoint,hammockCushionPoint } from './hammockGeometry.ts';
import { createDrapedCloth } from './drapedCloth.ts';
import { islandPalms,palmTrunkCenter } from '../../../config/islandVegetation.ts';
import { hammockLayout } from '../../../config/islandLiving.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';

type Skin={wood:THREE.Material;cloth:THREE.Material;wicker:THREE.Material;ceramic:THREE.Material;metal:THREE.Material;paper:THREE.Material;olive:THREE.Material};

/** Static living details join the dressing material batches and scene resource owner. */
export function createIslandLiving(p:StudioPrimitives,source:THREE.Group,skin:Skin) {
  const {wood,cloth,wicker,ceramic,metal,paper,olive}=skin;
  const roots:THREE.Group[]=[];
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  function root(name:string,x:number,z:number,angle=0) {
    const g=new THREE.Group();g.name=name;g.position.set(x,terrainHeight(x,z),z);g.rotation.y=angle;
    source.add(g);roots.push(g);return g;
  }
  function prop(key:keyof typeof livingProps) {const a=livingProps[key];return root(key,a.x,a.z,a.angle);}
  function tube(parent:THREE.Object3D,points:THREE.Vector3[],radius:number,material:THREE.Material) {
    return p.mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*2),radius,5,false),material,0,0,0);
  }
  function beam(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,material=wood) {
    const m=p.cylinder(parent,r,a.distanceTo(b),a.clone().add(b).multiplyScalar(.5).toArray(),material,r*.9);
    m.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());return m;
  }
  function ring(parent:THREE.Object3D,r:number,y:number,thickness:number,material:THREE.Material) {
    const mesh=p.mesh(parent,new THREE.TorusGeometry(r,thickness,6,48),material,0,y,0);mesh.rotation.x=Math.PI/2;return mesh;
  }
  function vessel(parent:THREE.Object3D,profile:number[][],at:number[],material=ceramic) {
    const curve=new THREE.CatmullRomCurve3(profile.map(([r,h])=>v(r,h,0)));
    return p.mesh(parent,new THREE.LatheGeometry(curve.getPoints(48).map(point=>new THREE.Vector2(Math.max(0,point.x),point.y)),32),material,...at as [number,number,number]);
  }
  function basket(parent:THREE.Object3D,r=.28,h=.42) {
    const g=new THREE.Group();parent.add(g);
    const rows=Math.round(h/.011),stakes=64;
    p.cylinder(g,r*.79,.019,[0,.019,0],wicker);
    for(let j=0;j<rows;j++) {
      const y=.026+j*(h-.038)/(rows-1),rad=r*(.79+.21*y/h);
      tube(g,Array.from({length:stakes*2+1},(_,i)=>{const a=i*Math.PI/stakes,rr=rad+.0035*Math.cos(a*stakes/2+j*Math.PI);return v(Math.cos(a)*rr,y+.0015*Math.sin(a*3+j),Math.sin(a)*rr);}),.0052,wicker);
    }
    for(let i=0;i<stakes;i++) {
      const a=i*Math.PI*2/stakes;
      tube(g,Array.from({length:rows*2+1},(_,j)=>{const t=j/(rows*2),rad=r*(.79+.21*t)+.0035*Math.cos(t*(rows-1)*Math.PI+i*Math.PI);return v(Math.cos(a)*rad,.023+(h-.032)*t,Math.sin(a)*rad);}),.004,wicker);
    }
    ring(g,r,h-.014,.011,wicker);
    for(const sign of [-1,1])tube(g,[v(sign*r*.94,h-.12,-.085),v(sign*r*1.06,h+.085,-.045),v(sign*r*1.06,h+.085,.045),v(sign*r*.94,h-.12,.085)],.012,wicker);
    return g;
  }
  function basketThrow(parent:THREE.Object3D,radius:number,height:number,width:number,length:number,angle:number,rolls=false) {
    const g=new THREE.Group();g.rotation.y=angle;parent.add(g);
    const {geometry,hem}=createDrapedCloth(width,length,height,radius,rolls);
    p.mesh(g,geometry,cloth,0,0,0);
    tube(g,hem,.0025,cloth);
    for(const [i,point] of hem.entries()) {
      const end=point.clone().add(v(.004*Math.sin(i*2.4),-.025,.01));end.y=Math.max(.006,end.y);
      tube(g,[point,point.clone().lerp(end,.6),end],.0018,cloth);
    }
  }
  function cushion(parent:THREE.Object3D,width:number,depth:number,at:THREE.Vector3,material:THREE.Material,angle=0,supported=false) {
    const g=new RoundedBoxGeometry(width,.18,depth,6,.075),a=g.attributes.position;
    for(let i=0;i<a.count;i++) {
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i),edge=Math.max(Math.abs(x)/(width/2),Math.abs(z)/(depth/2));
      a.setY(i,y*(.83+.35*Math.max(0,1-edge*edge))+.008*Math.sin(x*39+z*13)*edge);
      if(supported){const point=hammockCushionPoint(x,a.getY(i),z);a.setXYZ(i,point.x,point.y,point.z);}
    }
    g.computeVertexNormals();const m=p.mesh(parent,g,material,at.x,at.y,at.z);m.rotation.y=angle;
    const points=Array.from({length:81},(_,i)=>{const a=i/80*Math.PI*2,x=Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.32*width*.495,z=Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.32*depth*.495;return supported?hammockCushionPoint(x,0,z):v(x,0,z);});
    tube(m,points,.0035,material);return m;
  }
  function flatBook(parent:THREE.Object3D,at:THREE.Vector3,angle=0) {
    const g=new THREE.Group();g.position.copy(at);g.rotation.y=angle;parent.add(g);
    p.rounded(g,[.29,.041,.38],[0,.029,0],paper,.004);
    for(const y of [.006,.053])p.rounded(g,[.31,.01,.4],[0,y,0],olive,.003);
    p.rounded(g,[.012,.055,.4],[-.15,.027,0],olive,.003);
    for(const y of [.02,.03,.04])p.box(g,[.279,.001,.001],[.004,y,.191],wicker);
  }
  function roundTable(g:THREE.Group,r:number,h:number) {
    p.cylinder(g,r,.06,[0,h-.03,0],wood);
    for(let i=0;i<3;i++) {const a=i*Math.PI*2/3;beam(g,v(Math.cos(a)*r*.75,.025,Math.sin(a)*r*.75),v(Math.cos(a)*r*.5,h-.06,Math.sin(a)*r*.5),.027);}
  }
  const tea=prop('tea');
  for(const x of [-.49,.49])for(const z of [-.24,.24])p.rounded(tea,[.065,1.05,.065],[x,.525,z],wood,.007);
  for(const y of [.14,1.08])for(let i=0;i<4;i++)p.rounded(tea,[1.1,.055,.145],[0,y,(i-1.5)*.15],wood,.008);
  p.rounded(tea,[1.04,.08,.03],[0,1.11,-.305],wood,.005);
  const tray=new THREE.Group();tea.add(tray);tray.position.set(-.06,1.11,.015);
  p.rounded(tray,[.73,.025,.4],[0,.014,0],wood,.018);
  for(const x of [-.35,.35])p.rounded(tray,[.022,.055,.4],[x,.032,0],wood,.007);
  for(const z of [-.19,.19])p.rounded(tray,[.73,.045,.023],[0,.032,z],wood,.006);
  const pot=new THREE.Group();tray.add(pot);pot.position.set(-.06,.03,-.035);
  vessel(pot,[[0,0],[.09,0],[.13,.08],[.12,.17],[.083,.2],[.071,.206]],[0,0,0]);
  p.cylinder(pot,.082,.018,[0,.212,0],ceramic,.065);p.mesh(pot,new THREE.SphereGeometry(.021,12,8),ceramic,0,.235,0);
  tube(pot,[v(.09,.065,0),v(.15,.12,0),v(.2,.2,0)],.022,ceramic);
  tube(pot,[v(-.1,.055,0),v(-.19,.08,0),v(-.18,.18,0),v(-.1,.18,0)],.013,ceramic);
  for(const x of [-.23,.2]) {
    vessel(tray,[[0,0],[.048,0],[.057,.082],[.055,.092],[.044,.09],[.04,.014],[0,.014]],[x,.03,.09]);
    tube(tray,[v(x+.05,.1,.09),v(x+.085,.105,.09),v(x+.088,.065,.09),v(x+.05,.055,.09)],.007,ceramic);
  }
  vessel(tea,[[0,0],[.14,.006],[.2,.13],[.185,.32],[.09,.4],[.088,.43],[.068,.43],[.065,.4],[.15,.3],[.16,.1],[0,.035]],[-.24,.17,0]);
  const teaBasket=basket(tea,.19,.32);teaBasket.position.set(.26,.17,.01);
  const towel=new THREE.Group();tea.add(towel);towel.position.set(.52,0,.015);towel.rotation.y=Math.PI/2;
  const towelSurface=createDrapedCloth(.25,.7,1.117,.04);p.mesh(towel,towelSurface.geometry,cloth,0,0,0);

  const bench=prop('bench');
  for(const x of [-.48,.48])for(const z of [-.17,.17])p.rounded(bench,[.074,.43,.074],[x,.215,z],wood,.008);
  for(let i=0;i<3;i++)p.rounded(bench,[1.1,.068,.137],[0,.464,(i-1)*.145],wood,.01);
  for(const z of [-.165,.165])p.rounded(bench,[.99,.09,.04],[0,.32,z],wood,.005);
  const blankets=prop('blanketBasket');basket(blankets,.26,.39);
  for(const [i,x] of [-.092,.09].entries()) {
    const roll=new THREE.Group();blankets.add(roll);roll.position.set(x,.315,-.074+i*.016);roll.rotation.z=-.2+i*.31;roll.rotation.x=.32-i*.13;
    const shape=new THREE.Shape();
    for(const side of [1,-1])for(let j=0;j<=240;j++) {
      const t=(side===1?j:240-j)/240,angle=t*Math.PI*10,rad=.003+t*.092+side*.0035;
      const px=Math.cos(angle)*rad,py=Math.sin(angle)*rad*.85;
      if(j===0&&side===1)shape.moveTo(px,py);else shape.lineTo(px,py);
    }
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.3,steps:12,bevelEnabled:false});
    geometry.translate(0,0,-.15);geometry.rotateX(-Math.PI/2);
    const a=geometry.attributes.position;
    for(let j=0;j<a.count;j++)a.setY(j,a.getY(j)+.004*Math.sin(a.getX(j)*74+a.getZ(j)*29)+.002*Math.cos(a.getZ(j)*127));
    geometry.computeVertexNormals();p.mesh(roll,geometry,cloth,0,0,0);
  }
  basketThrow(blankets,.26,.39,.34,.78,0,true);
  const records=prop('records');basket(records,.27,.28);
  for(let i=0;i<5;i++) {
    const sleeve=p.rounded(records,[.34,.38,.018],[(i-2)*.015,.28,-.095+i*.045],i%2?olive:paper,.003);sleeve.rotation.z=(i-2)*.06;
    const disc=p.mesh(sleeve,new THREE.CircleGeometry(.125,40),metal,0,.016,.0105);
    p.mesh(disc,new THREE.CircleGeometry(.035,24),wicker,0,0,.001);
  }
  roundTable(prop('stool'),.24,.39);
  const bookTable=prop('hammockTable');roundTable(bookTable,.4,.49);flatBook(bookTable,v(-.04,.491,.02),-.24);
  const pillows=prop('cushions');
  cushion(pillows,.71,.66,v(0,.1,0),olive,-.08);cushion(pillows,.7,.65,v(.018,.29,.025),cloth,.12);
  const loungeBasket=prop('loungeBasket');basket(loungeBasket,.28,.4);basketThrow(loungeBasket,.28,.4,.48,.94,.22);

  const hammock=new THREE.Group();hammock.name='hammock';source.add(hammock);
  p.mesh(hammock,createHammockGeometry(),cloth,0,0,0);
  const anchors=hammockAnchors();
  for(const edge of [-1,1]) {
    tube(hammock,Array.from({length:81},(_,i)=>hammockPoint(i/80,edge,anchors)),.008,cloth);
    for(let i=0;i<51;i++){
      const u=.12+i/50*.76,point=hammockPoint(u,edge,anchors),end=point.clone();end.y-=.055+.035*Math.sin(u*Math.PI);
      tube(hammock,[point,point.clone().lerp(end,.5).add(v(.003,0,.005)),end],.0028,cloth);
    }
  }
  for(let end=0;end<2;end++) {
    const anchor=anchors[end],other=anchors[1-end],inward=other.clone().sub(anchor).setY(0).normalize();
    const palm=islandPalms.find(palm=>palm.seed===(end===0?hammockLayout.frontPalmSeed:hammockLayout.rearPalmSeed))!;
    const r=.155-.075*(hammockLayout.attachmentHeight+.2)/(palm.height+.14)+.013;
    const tie=anchor.clone().addScaledVector(inward,r+.013);tie.y-=.025;
    const angle=Math.atan2(inward.z,inward.x);
    tube(hammock,Array.from({length:145},(_,i)=>{const a=angle+i/144*Math.PI*6,y=hammockLayout.attachmentHeight+(i/144-.5)*.062;return new THREE.Vector3(...palmTrunkCenter(palm,y)).add(v(Math.cos(a)*r,0,Math.sin(a)*r));}),.009,wicker);
    const knot=p.mesh(hammock,new THREE.TorusKnotGeometry(.023,.007,48,5,2,3),wicker,tie.x,tie.y,tie.z);knot.quaternion.setFromUnitVectors(v(0,0,1),inward);
    const gathered=hammockPoint(end,0,anchors);
    for(const side of [-1,1]) {
      const offset=v(-inward.z,0,inward.x).multiplyScalar(side*.012);
      tube(hammock,[tie.clone().add(offset),gathered.clone().lerp(tie,.45).add(offset),gathered.clone().add(offset)],.009,wicker);
    }
    tube(hammock,[tie,tie.clone().addScaledVector(inward,.04).add(v(0,-.09,0)),tie.clone().addScaledVector(inward,.02).add(v(.012,-.23,0))],.008,wicker);
    for(let i=0;i<13;i++)tube(hammock,[gathered,hammockPoint(end===0?.045:.955,i/6-1,anchors)],.0028,cloth);
  }
  cushion(hammock,.55,.6,v(0,0,0),olive,0,true);

  for(const spec of livingPlanters) {
    const g=root(`planter-${spec.seed}`,spec.x,spec.z),r=spec.base*.59;
    vessel(g,[[0,0],[r*.65,0],[r,.13],[r*.96,spec.base*.8],[r*.73,spec.base],[r*.64,spec.base],[r*.69,spec.base-.035],[r*.86,spec.base*.75],[r*.79,.07],[0,.045]],[0,0,0],metal);
    p.cylinder(g,r*.65,.025,[0,spec.base-.035,0],wicker);
  }
  const firewood=prop('firewood');
  for(const x of [-.55,.55])for(const z of [-.25,.25])p.rounded(firewood,[.055,.68,.055],[x,.34,z],wood,.007);
  for(const y of [.12,.64])for(const z of [-.25,.25])p.rounded(firewood,[1.14,.05,.045],[0,y,z],wood,.005);
  const bark=p.material(0x514334,.96),endGrain=p.material(0xb38c59,.92);
  for(let row=0;row<3;row++)for(let i=0;i<5-row%2;i++) {
    const x=-.42+i*.205+(row%2)*.09,y=.22+row*.175,r=.085+.012*Math.sin(i*13+row*7);
    const log=p.cylinder(firewood,r,.49,[x,y,0],bark,r*.88);log.rotation.x=Math.PI/2;log.rotation.z=.05*Math.sin(i+row);
    for(const z of [-.251,.251]) {
      const face=p.mesh(firewood,new THREE.CircleGeometry(r*.89,14),endGrain,x,y,z);if(z<0)face.rotation.y=Math.PI;
      for(const rr of [.4,.72]){const ring=p.mesh(face,new THREE.TorusGeometry(r*rr,.0015,4,16),bark,0,0,.001);ring.scale.y=.92;}
    }
  }
  const pail=prop('pail');vessel(pail,[[0,0],[.12,0],[.16,.3],[.147,.305],[.11,.025],[0,.025]],[0,0,0],metal);ring(pail,.157,.297,.007,metal);
  tube(pail,[v(-.15,.23,0),v(-.19,.4,0),v(0,.47,0),v(.19,.4,0),v(.15,.23,0)],.007,metal);

  const fishing=prop('fishing');
  for(const x of [-.3,.3]) {
    p.rounded(fishing,[.05,.88,.06],[x,.45,0],wood,.006);
    p.rounded(fishing,[.08,.055,.48],[x,.03,.045],wood,.007);
  }
  for(const y of [.2,.73])p.rounded(fishing,[.67,.065,.11],[0,y,.01],wood,.006);
  const net=new THREE.Group();fishing.add(net);net.position.set(.46,.035,.13);net.rotation.z=-.17;
  beam(net,v(0,0,0),v(0,.94,0),.012,wood);
  tube(net,Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return v(Math.cos(a)*.24,1.15+Math.sin(a)*.36,0);}),.009,metal);
  for(let i=-5;i<=5;i++)for(const horizontal of [true,false]){
    const fixed=i/6,extent=Math.sqrt(1-fixed*fixed);
    tube(net,Array.from({length:17},(_,j)=>{const t=(j/8-1)*extent,u=horizontal?t:fixed,w=horizontal?fixed:t;return v(u*.235,1.15+w*.355,.17*(1-u*u-w*w));}),.0018,wicker);
  }
  for(let i=0;i<3;i++)for(const z of [-.215,.215])p.rounded(fishing,[.61,.09,.035],[.12,.055+i*.1,.37+z],wood,.005);
  for(const x of [-.17,.41])p.rounded(fishing,[.035,.3,.43],[x,.155,.37],wood,.005);
  for(let i=0;i<4;i++)p.rounded(fishing,[.15,.037,.46],[-.12+i*.16,.33,.37],wood,.005);
  const rope=prop('rope');
  tube(rope,Array.from({length:241},(_,i)=>{const t=i/240,a=t*Math.PI*10,r=.085+t*.18;return v(Math.cos(a)*r,.022+.004*Math.sin(a*3),Math.sin(a)*r);}),.014,wicker);
  const stone=p.material(0x979083,.96);
  for(const [index,spec] of landingStones.entries()) {
    const g=root(`landing-stone-${index}`,spec.x,spec.z,spec.angle),geometry=new THREE.CylinderGeometry(1,1,.065,14,1),points=geometry.attributes.position;
    for(let i=0;i<points.count;i++) {
      const x=points.getX(i),z=points.getZ(i),a=Math.atan2(z,x),r=1+.07*Math.sin(a*3+index)+.045*Math.cos(a*5-index);
      points.setXYZ(i,x*.38*r,points.getY(i),z*.265*r);
    }
    geometry.computeVertexNormals();p.mesh(g,geometry,stone,0,.027,0);
  }
  source.updateMatrixWorld(true);
  const placements=roots.map(g=>{
    const bounds=new THREE.Box3().setFromObject(g);g.position.y+=terrainHeight(g.position.x,g.position.z)-bounds.min.y;
    g.updateMatrixWorld(true);return {name:g.name,x:g.position.x,z:g.position.z,bounds:new THREE.Box3().setFromObject(g)};
  });
  hammock.updateMatrixWorld(true);
  placements.push({name:'hammock',x:(anchors[0].x+anchors[1].x)/2,z:(anchors[0].z+anchors[1].z)/2,bounds:new THREE.Box3().setFromObject(hammock)});
  return placements;
}
