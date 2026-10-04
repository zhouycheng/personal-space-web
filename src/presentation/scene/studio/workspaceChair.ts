import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CHAIR_ROCKER_RADIUS } from '../../../animation/studio/chairMotion.ts';
import { workspaceAppearance } from '../../../config/workspaceAppearance.ts';
import { createWorkspaceMaterials } from './workspaceMaterials.ts';
import type { StudioPrimitives } from './studioPrimitives';

export function createWorkspaceChair(p:StudioPrimitives,materials:Set<THREE.Material>,textures:Set<THREE.Texture>) {
  const chair=p.hotspot('chair');chair.position.fromArray(workspaceAppearance.chair);
  const chairSeat=new THREE.Group();chairSeat.name='rocking-chair-body';chair.add(chairSeat);
  const {timber,canvas}=createWorkspaceMaterials(materials,textures);
  const wood=timber.clone();wood.color.setHex(0xb28c60);wood.roughness=.57;materials.add(wood);
  // Solid upholstery on both sides, without the coarse repeating grid or self-shadow acne.
  const fabric=canvas.clone();fabric.color.setHex(0xe2d6bd);fabric.bumpScale=.00012;materials.add(fabric);
  const piping=p.material(0xc9b898,.94);
  fabric.side=THREE.FrontSide;
  function curved(points:number[][],radius:number,material:THREE.Material=wood) {
    const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v as [number,number,number])));
    return p.mesh(chairSeat,new THREE.TubeGeometry(curve,36,radius,12,false),material,0,0,0);
  }
  const R=CHAIR_ROCKER_RADIUS;
  for(const side of [-1,1]) {
    const x=side*.47,shape=new THREE.Shape();
    for(let i=0;i<=48;i++){const z=-.66+i*1.4/48,y=.009+R-Math.sqrt(R*R-z*z);if(i===0)shape.moveTo(z,y);else shape.lineTo(z,y);}
    for(let i=48;i>=0;i--){const z=-.66+i*1.4/48;shape.lineTo(z,.069+R-Math.sqrt(R*R-z*z));}shape.closePath();
    const runner=p.mesh(chairSeat,new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:3,steps:1}),wood,x-.03,0,0);runner.rotation.y=Math.PI/2;runner.name='curved-rocker';
    curved([[x,.1,-.39],[x,.48,-.32],[x,.95,-.31],[x,1.12,-.32]],.035);
    curved([[x,.11,.4],[x,.54,.31],[x,.96,.36],[x,1.43,.48],[x,1.66,.5]],.035);
    curved([[x,.76,-.35],[x,.73,-.05],[x,.75,.33]],.034);
    const armGeometry=new RoundedBoxGeometry(.145,.07,.84,6,.027),armPosition=armGeometry.attributes.position;
    for(let i=0;i<armPosition.count;i++){
      const z=armPosition.getZ(i),t=(z+.42)/.84;
      armPosition.setXYZ(i,armPosition.getX(i)*(.83+.17*Math.sin(Math.PI*t)),armPosition.getY(i)+.018*Math.sin(Math.PI*t)-.035*z,z);
      // The grain follows the arm rather than wrapping across its width.
      armGeometry.attributes.uv.setXY(i,z*2,armPosition.getX(i)*3+armPosition.getY(i));
    }
    armGeometry.computeVertexNormals();
    p.mesh(chairSeat,armGeometry,wood,x,1.105,.045);
    for(const [y,z] of [[.77,-.32],[1.1,-.3],[1.12,.39]]) {
      const pin=p.cylinder(chairSeat,.014,.008,[x+side*.04,y,z],p.brass);pin.rotation.z=Math.PI/2;
    }
    // Shaped shoulders spread the load where the uprights meet the arm rests.
    for(const z of [-.3,.38]){
      const shoulder=p.mesh(chairSeat,new RoundedBoxGeometry(.072,.14,.092,4,.022),wood,x,1.04,z);
      shoulder.rotation.x=z>0?-.16:.08;
    }
  }
  curved([[-.47,.27,-.3],[0,.25,-.3],[.47,.27,-.3]],.024);
  curved([[-.47,.34,.34],[0,.32,.34],[.47,.34,.34]],.026);
  curved([[-.47,1.63,.5],[0,1.65,.52],[.47,1.63,.5]],.029);
  curved([[-.47,.756,-.34],[0,.751,-.34],[.47,.756,-.34]],.028);
  curved([[-.47,.795,.33],[0,.79,.33],[.47,.795,.33]],.028);
  function panel(back:boolean) {
    const positions:number[]=[],indices:number[]=[],uvs:number[]=[],nx=28,ny=28;
    const surface=(u:number,v:number,face:number)=>{
      const x=(u-.5)*.84,sag=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      const gathering=.0025*Math.sin(u*76+v*5)*Math.exp(-Math.min(v,1-v)*18)*Math.sin(Math.PI*u);
      return new THREE.Vector3(x,back?.81+v*.79:.775-sag*.055+face*.022,
        back?.33+v*.15+sag*.052+gathering+face*.018:-.34+v*.67);
    };
    const stride=(nx+1)*(ny+1);
    for(const face of [-1,1])for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){positions.push(...surface(i/nx,j/ny,face).toArray());uvs.push(i/nx*3,j/ny*3);}
    for(let f=0;f<2;f++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
      const a=f*stride+j*(nx+1)+i,b=a+nx+1;
      const flip=back?f===1:f===0;
      if(flip)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);
    }
    const edge:number[]=[];for(let i=0;i<=nx;i++)edge.push(i);for(let j=1;j<=ny;j++)edge.push(j*(nx+1)+nx);
    for(let i=nx-1;i>=0;i--)edge.push(ny*(nx+1)+i);for(let j=ny-1;j>0;j--)edge.push(j*(nx+1));
    for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,b,a+stride,b,b+stride,a+stride);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const cloth=p.mesh(chairSeat,geometry,fabric,0,0,0);cloth.receiveShadow=false;cloth.name=back?'solid-canvas-back':'solid-canvas-seat';
    for(const face of [-1,1]) {
      const outline=edge.map(index=>surface(index%(nx+1)/nx,Math.floor(index/(nx+1))/ny,face));outline.push(outline[0]);
      const seam=p.mesh(chairSeat,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline),112,.004,6,false),piping,0,0,0);seam.castShadow=false;seam.receiveShadow=false;
    }
  }
  panel(false);panel(true);
  return {chair,chairSeat};
}
