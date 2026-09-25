import * as THREE from "three";
import { studioPalette as palette } from "../../../config/studioPalette";
import type { StudioPrimitives } from "./studioPrimitives";

export function createStudioAtmosphere(scene: THREE.Scene, room: THREE.Group, primitives: StudioPrimitives, materials: Set<THREE.Material>, textures: Set<THREE.Texture>, cleanup: (() => void)[]) {
  const { material, mesh, box, cylinder, rounded, hotspot, label, charcoal, brass } = primitives;
  const mug=new THREE.Group();room.add(mug);mug.position.set(-1.1,1.448,-0.94);mug.userData.label="一杯咖啡";
  const ceramic=material(palette.paper,0.24),coffee=material(0x382015,0.16);
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
  
  // Angled desktop clock: one reusable texture, sourced from the visitor's clock.
  const deskClock=hotspot("clock");deskClock.position.set(0.67,1.572,-1.83);deskClock.rotation.y=-0.12;
  rounded(deskClock,[0.61,0.27,0.15],[0,0,0],charcoal,0.025);
  const clockFace=label(deskClock,"",0.55,0.21,[0,0,0.079],"#101d1d","#b5edc7",0.63);
  const clockTexture=(clockFace.material as THREE.MeshBasicMaterial).map!;
  const clockImage=clockTexture.image as HTMLCanvasElement;
  
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
  const shadeMaterial=material(palette.lamp,0.38);
  const shadeProfile=[[0,-0.045],[0.055,-0.045],[0.075,-0.065],[0.19,-0.22],[0.203,-0.244],[0.218,-0.244],[0.22,-0.229],[0.09,-0.04],[0.063,-0.018],[0.063,0.005],[0,0.005]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(shade,new THREE.LatheGeometry(shadeProfile,48),shadeMaterial,0,-0.065,0);
  cylinder(shade,0.025,0.07,[0,-0.03,0],brass);
  const diffuserMaterial=material(0xffe3aa,0.5);diffuserMaterial.emissive.setHex(0xffce87);diffuserMaterial.emissiveIntensity=1.5;
  const diffuser=mesh(shade,new THREE.CircleGeometry(0.182,40),diffuserMaterial,0,-0.286,0);diffuser.rotation.x=Math.PI/2;diffuser.castShadow=false;
  const lamp=new THREE.SpotLight(0xffdfb0,0,5,Math.PI/3.5,0.72,2);
  lamp.position.copy(new THREE.Vector3(0,-0.315,0).applyQuaternion(shade.quaternion).add(head));lamp.target=lampTarget;
  lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=0.05;lamp.shadow.camera.far=5;
  lamp.shadow.bias=-0.0002;lamp.shadow.normalBias=0.008;scene.add(lamp);
  const ambient=new THREE.HemisphereLight(0xf5f2eb,0xa29b8d,2.6);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffedce,3.2);sun.position.set(-3,7,2.5);sun.castShadow=true;
  cleanup.push(()=>{sun.shadow.map?.dispose();lamp.shadow.map?.dispose();});
  sun.target.position.set(0,0,-0.8);scene.add(sun.target);
  sun.shadow.radius=12;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-3.8;sun.shadow.camera.right=3.8;sun.shadow.camera.top=3.8;sun.shadow.camera.bottom=-3.8;
  sun.shadow.camera.near=0.5;sun.shadow.camera.far=16;sun.shadow.normalBias=0.012;sun.shadow.bias=-0.0001;scene.add(sun);
  return { steam, deskClock, clockImage, clockTexture, lampModel, diffuserMaterial, lamp, sun, ambient };
}
