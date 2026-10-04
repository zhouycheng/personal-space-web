import * as THREE from 'three';
import {createWoolMaterial,addWoolPile} from './woolRug.ts';
import {createHurricaneLantern} from './hurricaneLantern.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dressingProps } from '../../../config/islandDressing.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { workspaceAppearance } from '../../../config/workspaceAppearance.ts';
import { createWorkspaceMaterials } from './workspaceMaterials.ts';
import { createDressingMaterials } from './dressingMaterials.ts';
import { breezeGLSL } from '../../../animation/studio/breeze.ts';
import type { StudioPrimitives } from './studioPrimitives';

/** Decorative objects are baked by material, outside every furniture hotspot. */
export function createIslandDressing(p:StudioPrimitives,materials:Set<THREE.Material>,geometries:Set<THREE.BufferGeometry>,textures:Set<THREE.Texture>) {
  const source=new THREE.Group(),group=new THREE.Group();group.name='island-dressing';
  const {canvas,cork}=createWorkspaceMaterials(materials,textures);
  const {timber,leather,metal,ceramic,paper,brass,reflection}=createDressingMaterials(materials,textures);
  timber.vertexColors=true;
  const bagFabric=canvas.clone();bagFabric.color.setHex(0x687460);materials.add(bagFabric);
  const dark=p.material(0x353c35,.82);
  const wick=p.material(0xffd79b,.55);wick.emissive.setHex(0xffb45e);
  const glass=new THREE.MeshPhysicalMaterial({color:0xe5eee5,roughness:.075,metalness:0,clearcoat:1,clearcoatRoughness:.06,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});materials.add(glass);
  glass.envMap=reflection;glass.envMapIntensity=.9;
  const flameCore=new THREE.MeshBasicMaterial({color:0xffefd0,toneMapped:false});materials.add(flameCore);
  const drapedCanvas=canvas.clone();drapedCanvas.side=THREE.DoubleSide;materials.add(drapedCanvas);
  const windTime={value:0};
  const clothDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});materials.add(clothDepth);
  for(const material of [drapedCanvas,clothDepth]) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.breezeTime=windTime;
      shader.vertexShader=`uniform float breezeTime;attribute float windWeight;${breezeGLSL}\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed+=vec3(.85,.2,.53)*.055*windWeight*breezeAt(position.xz,breezeTime);`);
    };
    material.customProgramCacheKey=()=> 'supported-cloth-breeze-v1';
  }
  const roots:THREE.Group[]=[];
  const lanternLights:THREE.PointLight[]=[];
  function root(key:keyof typeof dressingProps) {
    const spec=dressingProps[key],g=new THREE.Group();g.name=key;g.userData.seed=spec.seed;g.position.set(spec.x,terrainHeight(spec.x,spec.z),spec.z);g.rotation.y=spec.angle;source.add(g);roots.push(g);return g;
  }
  function tube(parent:THREE.Object3D,points:number[][],radius:number,mat:THREE.Material) {
    return p.mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v as [number,number,number]))),20,radius,6,false),mat,0,0,0);
  }
  function vase(parent:THREE.Object3D,x:number,y:number,z:number,scale:number) {
    const outline=[[0,0],[.1,0],[.145,.04],[.16,.15],[.12,.26],[.08,.3],[.08,.33],[.065,.33],[.065,.29],[.105,.25],[.135,.15],[.12,.055],[0,.025]].map(([r,h])=>new THREE.Vector3(r,h,0));
    const profile=new THREE.CatmullRomCurve3(outline).getPoints(80).map(v=>new THREE.Vector2(Math.max(0,v.x)*scale,Math.max(0,v.y)*scale));
    return p.mesh(parent,new THREE.LatheGeometry(profile,40),ceramic,x,y,z);
  }
  function nail(parent:THREE.Object3D,x:number,y:number,z:number) {
    const head=p.cylinder(parent,.008,.003,[x,y,z],brass);head.rotation.x=Math.PI/2;
  }
  function book(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,cover:THREE.Material) {
    p.rounded(parent,[w,h,d],[x,y+h/2,z],paper,.004);
    for(const dx of [-w/2,w/2])p.rounded(parent,[.014,h+.024,d+.025],[x+dx,y+h/2,z],cover,.004);
    p.rounded(parent,[w+.014,h+.024,.018],[x,y+h/2,z+d/2],cover,.004);
    // Recessed page edges, headbands and an inset spine label break the solid-block silhouette.
    for(const dy of [.065,h-.055])p.rounded(parent,[w+.017,.009,.006],[x,y+dy,z+d/2+.011],brass,.002);
    p.rounded(parent,[w*.7,h*.2,.004],[x,y+h*.63,z+d/2+.011],paper,.002);
    for(let i=1;i<7;i++)p.box(parent,[.001,h-.012,d-.005],[x-w/2+i*w/7,y+h/2,z-.004],canvas);
  }
  function lantern(parent:THREE.Object3D,x:number,y:number,z:number,scale=1) {
    const g=createHurricaneLantern(p,{metal,brass,dark,glass,wick,core:flameCore});
    g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
    const light=new THREE.PointLight(0xffb35f,.5,3.3,1);light.position.set(0,.245,0);light.castShadow=false;g.add(light);lanternLights.push(light);
  }
  function foldedCloth(parent:THREE.Object3D,x:number,y:number,z:number) {
    const geo=new THREE.PlaneGeometry(.48,.65,12,18),a=geo.attributes.position;
    const weights=new Float32Array(a.count);
    for(let i=0;i<a.count;i++){const u=a.getX(i),v=a.getY(i),hang=Math.max(0,-v-.12);weights[i]=(hang/.205)**2;a.setXYZ(i,u+.012*Math.sin(v*12),.008+.007*Math.sin(u*25+v*7)+hang*.08*Math.cos(u*34)-hang*1.1,v+hang*.22);}
    geo.setAttribute('windWeight',new THREE.BufferAttribute(weights,1));
    geo.computeVertexNormals();p.mesh(parent,geo,drapedCanvas,x,y,z);
  }
  const suitcase=root('suitcase'),s=dressingProps.suitcase;
  p.rounded(suitcase,[s.width,s.height*.58,s.depth],[0,s.height*.29,0],leather,.065);
  p.rounded(suitcase,[s.width,s.height*.39,s.depth],[0,s.height*.805,0],leather,.06);
  for(const x of [-.32,.32]) {
    p.rounded(suitcase,[.048,.018,s.depth*.96],[x,s.height+.006,0],leather,.007);
    p.rounded(suitcase,[.05,s.height*.86,.018],[x,s.height*.48,s.depth/2],leather,.007);
    p.rounded(suitcase,[.075,.06,.025],[x,s.height*.58,s.depth/2+.012],p.brass,.009);
  }
  tube(suitcase,[[-.12,.27,.33],[-.1,.35,.4],[.1,.35,.4],[.12,.27,.33]],.023,leather);
  for(const x of [-.49,.49])for(const z of [-.275,.275])p.rounded(suitcase,[.085,.09,.085],[x,.09,z],p.brass,.017);
  foldedCloth(suitcase,-.22,s.height+.027,.09);
  const travelBooks=new THREE.Group();suitcase.add(travelBooks);travelBooks.position.set(.2,s.height+.015,-.02);travelBooks.rotation.z=-Math.PI/2;travelBooks.rotation.y=.13;
  book(travelBooks,0,0,0,.055,.3,.23,bagFabric);
  book(travelBooks,.064,.015,.025,.045,.26,.21,leather);

  const backpack=root('backpack');
  const bagGeometry=new RoundedBoxGeometry(.52,.66,.32,5,.075),positions=bagGeometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),t=(y+.33)/.66;
    positions.setXYZ(i,x*(1-.2*t)+.026*Math.sin(t*8),y,z+.022*Math.sin(t*15+x*12)*(1-t)+.07*t*t);
  }
  bagGeometry.computeVertexNormals();p.mesh(backpack,bagGeometry,bagFabric,0,.34,0);
  p.rounded(backpack,[.44,.16,.36],[.012,.635,.015],bagFabric,.05);
  p.rounded(backpack,[.34,.26,.11],[-.015,.25,.2],bagFabric,.038);
  for(const x of [-.14,.14]) {
    tube(backpack,[[x,.61,-.12],[x*1.6,.42,-.28],[x*1.4,.13,-.2],[x,.09,-.08]],.023,leather);
    p.rounded(backpack,[.038,.22,.016],[x,.56,.202],leather,.005);
    p.rounded(backpack,[.048,.038,.024],[x,.47,.215],p.brass,.005);
  }
  tube(backpack,[[-.08,.69,0],[-.07,.77,.01],[.07,.77,.01],[.08,.69,0]],.019,leather);
  tube(backpack,[[-.17,.14,.263],[-.17,.36,.255],[.16,.36,.255],[.16,.14,.263]],.003,canvas);

  const cabinet=root('cabinet'),c=dressingProps.cabinet;
  for(const x of [-c.width/2+.025,c.width/2-.025])p.rounded(cabinet,[.05,c.height,c.depth],[x,c.height/2,0],timber,.009);
  const shelves=[.09,c.height*.36,c.height*.66,c.height-.0275];
  for(const y of shelves)p.rounded(cabinet,[c.width,.055,c.depth],[0,y,0],timber,.009);
  for(const y of shelves.slice(1))for(const side of [-1,1]) {
    p.rounded(cabinet,[.04,.05,c.depth-.04],[side*(c.width/2-.047),y-.05,0],timber,.005);
    nail(cabinet,side*(c.width/2-.025),y,-c.depth/2-.002);
  }
  for(const x of [-c.width/2+.045,c.width/2-.045])p.rounded(cabinet,[.075,c.height,.035],[x,c.height/2,c.depth/2-.012],timber,.012);
  for(let i=0;i<5;i++)p.rounded(cabinet,[c.width/5-.008,c.height-.08,.03],[(i-2)*c.width/5,c.height/2+.01,-c.depth/2+.015],timber,.005);
  book(cabinet,-.42,shelves[1]+.0275,.04,.075,.35,.31,leather);
  book(cabinet,-.31,shelves[1]+.0275,.02,.085,.39,.32,bagFabric);
  book(cabinet,-.19,shelves[1]+.0275,.04,.055,.32,.29,leather);
  vase(cabinet,.27,shelves[1]+.0275,.04,.86);vase(cabinet,-.34,shelves[2]+.0275,.035,1.0);
  function flatBooks(parent:THREE.Object3D,x:number,y:number,z:number,count:number) {
    for(let i=0;i<count;i++) {
      const g=new THREE.Group();parent.add(g);g.position.set(x+(i%2)*.025,y+.034+i*.075,z-i*.016);g.rotation.y=.08-i*.13;g.rotation.z=-Math.PI/2;
      book(g,0,-.19,0,.055,.38-i*.02,.29,i%2?bagFabric:leather);
    }
  }
  flatBooks(cabinet,.27,shelves[2]+.0275,.02,3);
  flatBooks(cabinet,.27,c.height,.015,2);
  for(let i=0;i<4;i++)book(cabinet,-.45+i*.095,c.height,-.015+(i%2)*.035,.065,.34+(i%3)*.045,.29,i%2?bagFabric:leather);
  const roll=p.cylinder(cabinet,.13,.42,[.12,.246,0],canvas);roll.rotation.z=Math.PI/2;
  for(const x of [-.02,.27]) {const tie=p.mesh(cabinet,new THREE.TorusGeometry(.133,.009,6,24),leather,x,.246,0);tie.rotation.y=Math.PI/2;}

  const table=root('sideTable'),t=dressingProps.sideTable;
  p.rounded(table,[t.width,.07,t.depth],[0,t.height-.035,0],timber,.014);
  for(const x of [-.27,.27])for(const z of [-.23,.23])p.rounded(table,[.065,t.height-.07,.065],[x,(t.height-.07)/2,z],timber,.008);
  p.rounded(table,[.63,.045,.5],[0,.19,0],timber,.006);
  lantern(table,-.1,t.height,.045,1.05);
  vase(table,.23,t.height,-.17,.45);
  foldedCloth(table,.08,t.height+.005,-.03);

  const crate=root('supplyCrate'),cr=dressingProps.supplyCrate;
  p.rounded(crate,[cr.width,.05,cr.depth],[0,.035,0],timber,.008);
  for(const x of [-.4,.4])for(const z of [-.28,.28])p.rounded(crate,[.055,.48,.055],[x,.27,z],timber,.008);
  for(let i=0;i<3;i++) {
    const y=.13+i*.145;
    for(const z of [-.3,.3])p.rounded(crate,[cr.width,.12,.035],[0,y,z],timber,.006);
    for(const x of [-.38,.38])for(const z of [-.319,.319])nail(crate,x,y,z);
    for(const x of [-.42,.42])p.rounded(crate,[.035,.12,cr.depth],[x,y,0],timber,.006);
  }
  // A closed base supports two smaller boxes; offsets stay inside the supporting lid.
  for(let i=0;i<4;i++)p.rounded(crate,[cr.width,.04,.16],[0,.53,(i-1.5)*.16],timber,.006);
  function stackedBox(parent:THREE.Object3D,width:number,depth:number,height:number,x:number,y:number,z:number,angle:number) {
    const box=new THREE.Group();parent.add(box);box.position.set(x,y,z);box.rotation.y=angle;
    p.rounded(box,[width,.035,depth],[0,.0175,0],timber,.006);
    for(let i=0;i<3;i++) {
      const h=height/3-.012,cy=(i+.5)*height/3;
      for(const dz of [-depth/2+.016,depth/2-.016])p.rounded(box,[width,h,.032],[0,cy,dz],timber,.006);
      for(const dx of [-width*.35,width*.35])for(const dz of [-depth/2-.011,depth/2+.011])nail(box,dx,cy,dz);
      for(const dx of [-width/2+.016,width/2-.016])p.rounded(box,[.032,h,depth],[dx,cy,0],timber,.006);
    }
    for(const dx of [-width*.35,width*.35])for(const dz of [-depth/2,depth/2])p.rounded(box,[.04,height,.018],[dx,height/2,dz],timber,.004);
    p.rounded(box,[width,.035,depth],[0,height-.0175,0],timber,.006);
    tube(box,[[-.085,height*.56,depth/2+.015],[-.07,height*.4,depth/2+.055],[.07,height*.4,depth/2+.055],[.085,height*.56,depth/2+.015]],.012,leather);
  }
  stackedBox(crate,.73,.51,.42,.025,.55,-.015,-.14);
  stackedBox(crate,.55,.41,.35,-.045,.97,.005,.09);
  lantern(crate,-.045,cr.height,.005,.85);

  const lowCase=root('lowCase'),lc=dressingProps.lowCase;
  stackedBox(lowCase,lc.width,lc.depth,lc.height,0,0,0,0);
  foldedCloth(lowCase,-.06,lc.height+.009,.045);flatBooks(lowCase,.04,lc.height+.022,.04,2);
  const bookCrate=root('bookCrate'),bc=dressingProps.bookCrate;
  stackedBox(bookCrate,bc.width,bc.depth,bc.height,0,0,0,0);
  flatBooks(bookCrate,-.14,bc.height,.025,3);vase(bookCrate,.23,bc.height,-.035,.6);
  const propped=new THREE.Group();bookCrate.add(propped);propped.position.set(-.03,0,.34);propped.rotation.x=-.19;propped.rotation.z=.13;
  book(propped,0,0,0,.075,.35,.24,leather);

  // A hanging lamp creates a third warm pocket at the back of the work area.
  lantern(source,-2.22,2.49,-2.65,.82);
  tube(source,[[-2.5,3.48,-2.9],[-2.25,3.42,-2.68],[-2.22,3.05,-2.65]],.009,brass);

  // A low woven mat joins desk, chair and storage visually without moving their floor anchors.
  const matMaterial=createWoolMaterial(materials,0xb49b71);
  const rugSurface=(u:number,v:number)=>{const x=u+Math.sin(v*3)*.014,z=v-.62+u*.035;return new THREE.Vector3(x,terrainHeight(x,z)+.014+.003*Math.sin(u*17+v*9),z);};
  const matGeometry=new THREE.PlaneGeometry(4.4,3.15,32,24),matPoints=matGeometry.attributes.position;
  for(let i=0;i<matPoints.count;i++) {
    const point=rugSurface(matPoints.getX(i),matPoints.getY(i));
    matPoints.setXYZ(i,point.x,point.y,point.z);
  }
  matGeometry.computeVertexNormals();p.mesh(source,matGeometry,matMaterial,0,0,0).castShadow=false;
  addWoolPile(p,source,matMaterial,4.4,3.15,rugSurface);
  for(let i=0;i<46;i++)for(const edge of [-1,1]) {
    const x=-2.14+i*.095,z=edge*1.575-.62+x*.035;
    tube(source,[[x,terrainHeight(x,z)+.01,z],[x+.014*Math.sin(i),terrainHeight(x,z)+.012,z+edge*(.045+.025*Math.sin(i*7))]],.004,matMaterial);
  }

  const basket=root('basket');
  p.mesh(basket,new THREE.LatheGeometry([[0,.02],[.215,.02],[.265,.395],[.248,.395],[.20,.045],[0,.045]].map(([r,h])=>new THREE.Vector2(r,h)),40),cork,0,0,0);
  for(let i=0;i<9;i++){const band=p.mesh(basket,new THREE.TorusGeometry(.225+i*.0045,.012,5,28),canvas,0,.045+i*.04,0);band.rotation.x=Math.PI/2;}
  for(let i=0;i<28;i++) {
    const a=i*Math.PI/14;
    tube(basket,Array.from({length:13},(_,j)=>{const y=.035+j*.03,r=.223+j*.0034+.006*Math.sin(j*Math.PI*1.5+i*Math.PI);return [Math.cos(a)*r,y,Math.sin(a)*r];}),.005,cork);
  }
  for(const side of [-1,1])tube(basket,[[side*.2,.28,0],[side*.31,.43,0],[side*.2,.49,0]],.018,leather);
  foldedCloth(basket,.02,.415,.05);

  const desktop=new THREE.Group();source.add(desktop);desktop.position.set(-1.24,workspaceAppearance.tabletop+.008,-1.65);desktop.rotation.y=.08;
  vase(desktop,.29,0,-.02,.48);
  for(let i=0;i<3;i++) {const pen=p.cylinder(desktop,.007,.22,[.28+i*.012,.2,-.023+i*.012],i===1?dark:timber);pen.rotation.z=(i-1)*.13;}

  // Grounded feet and bags are aligned after their final rotation, before batching.
  source.updateMatrixWorld(true);
  const placements=roots.map(root=>{
    const bounds=new THREE.Box3().setFromObject(root);
    root.position.y+=terrainHeight(root.position.x,root.position.z)-bounds.min.y;
    root.updateMatrixWorld(true);
    return {name:root.name,x:root.position.x,z:root.position.z,bounds:new THREE.Box3().setFromObject(root)};
  });
  for(const root of roots)for(let i=0;i<6;i++) {
    const angle=i*2.39996+root.userData.seed,r=.33+(i%3)*.11;
    const x=root.position.x+Math.cos(angle)*r,z=root.position.z+Math.sin(angle)*r;
    if(i%2===0){const twig=p.cylinder(source,.008,.12,[x,terrainHeight(x,z)+.01,z],timber);twig.rotation.z=Math.PI/2;twig.rotation.y=angle;}
    else {const leaf=p.mesh(source,new THREE.SphereGeometry(.055,8,4),cork,x,terrainHeight(x,z)+.008,z);leaf.scale.set(1,.08,.32);leaf.rotation.y=angle;}
  }
  source.updateMatrixWorld(true);
  for(const light of lanternLights) {
    const position=light.getWorldPosition(new THREE.Vector3());light.removeFromParent();light.position.copy(position);group.add(light);
  }
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  let woodIndex=0;
  source.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);
    const mat=object.material as THREE.Material;
    if(mat===timber) {
      const count=geometry.attributes.position.count,colours=new Float32Array(count*3),shade=.87+.12*(Math.sin(++woodIndex*7.13)*.5+.5);
      for(let i=0;i<count;i++){colours[i*3]=shade;colours[i*3+1]=shade*.985;colours[i*3+2]=shade*.955;}
      geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
    }
    if(mat===glass) {
      // Keep each chimney/rim independently sortable instead of merging distant transparent surfaces.
      geometry.computeBoundingBox();const center=geometry.boundingBox!.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);
      geometries.add(geometry);const mesh=new THREE.Mesh(geometry,mat);mesh.position.copy(center);group.add(mesh);return;
    }
    const parts=batches.get(mat)??[];parts.push(geometry);batches.set(mat,parts);
  });
  for(const [material,pieces] of batches) {
    const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());geometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=material!==wick&&material!==flameCore&&material!==matMaterial;mesh.receiveShadow=material!==flameCore;group.add(mesh);
    if(material===drapedCanvas){mesh.customDepthMaterial=clothDepth;geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=.1;}
  }
  group.userData.placements=placements;
  return {group,setWind(seconds:number){windTime.value=seconds;},setLighting(daylight:number){
    wick.emissiveIntensity=.8+(1-daylight)*2.1;
    for(const mat of [metal,brass,ceramic])mat.envMapIntensity=.12+daylight*.6;
    glass.envMapIntensity=.18+daylight*.8;
    for(const light of lanternLights)light.intensity=.3+(1-daylight)*2.4;
  }};
}
