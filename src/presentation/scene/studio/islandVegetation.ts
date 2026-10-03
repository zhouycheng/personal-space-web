import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { islandPalms,islandUnderstory } from '../../../config/islandVegetation.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';

const variation=(seed:number)=>{const x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x);};
type LeafMesh={positions:number[];colors:number[];indices:number[]};

/** Curved, folded leaflets model the silhouette and cast individual leaf shadows. */
function blade(mesh:LeafMesh,start:THREE.Vector3,end:THREE.Vector3,width:number,seed:number,dry=false) {
  const offset=mesh.positions.length/3,segments=6;
  const direction=end.clone().sub(start);
  const side=new THREE.Vector3(-direction.z,0,direction.x).normalize();
  const green=dry?new THREE.Color(0x786344):new THREE.Color().setHSL(.25+variation(seed)*.045,.48+variation(seed+1)*.15,.23+variation(seed+2)*.09).convertSRGBToLinear();
  for(let i=0;i<=segments;i++) {
    const t=i/segments;
    const center=start.clone().addScaledVector(direction,t);
    center.y+=Math.sin(t*Math.PI)*direction.length()*.11-t*t*direction.length()*.12;
    const span=width*Math.pow(Math.sin(Math.PI*t),.65);
    for(let edge=-1;edge<=1;edge++) {
      const point=center.clone().addScaledVector(side,span*edge);
      point.y+=edge===0?span*.42:0;
      mesh.positions.push(point.x,point.y,point.z);
      const color=green.clone().multiplyScalar((edge===0?1.12:.92)*(1+.14*t));
      mesh.colors.push(color.r,color.g,color.b);
    }
    if(i<segments) for(let edge=0;edge<2;edge++) {
      const a=offset+i*3+edge,b=a+3;
      mesh.indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
}

function frond(mesh:LeafMesh,stems:THREE.BufferGeometry[],origin:THREE.Vector3,
  angle:number,length:number,lift:number,drop:number,seed:number,fern=false) {
  const along=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
  const across=new THREE.Vector3(-along.z,0,along.x);
  const center=(t:number)=>origin.clone().addScaledVector(along,length*t)
    .addScaledVector(across,Math.sin(Math.PI*t)*length*.045*Math.sin(seed))
    .add(new THREE.Vector3(0,lift*Math.sin(Math.PI*t*.8)-drop*t*t,0));
  const points=Array.from({length:17},(_,i)=>center(i/16));
  const curve=new THREE.CatmullRomCurve3(points);
  const stem=new THREE.TubeGeometry(curve,20,fern?.008:.013,4,false);
  stem.deleteAttribute('uv');stems.push(stem);
  const pairs=fern?17:29;
  for(let i=0;i<pairs;i++) {
    const t=.12+i/(pairs-1)*.83;
    for(const sign of [-1,1]) {
      const localSeed=seed+i*7+sign;
      const start=center(t+(sign===1?.008:0));
      const spread=length*(fern?.23:.28)*Math.pow(Math.sin(Math.PI*t),.8)*( .85+variation(localSeed)*.25);
      const end=start.clone().addScaledVector(across,sign*spread)
        .addScaledVector(along,spread*(.35+variation(localSeed+3)*.3));
      end.y-=spread*(.35+variation(localSeed+4)*.3);
      blade(mesh,start,end,length*(fern?.035:.025)*(1-.45*t),localSeed);
    }
  }
}

function trunk(x:number,z:number,height:number,leanX:number,leanZ:number) {
  const base=terrainHeight(x,z)-.2,positions=[],indices=[];
  const rings=76,sides=14;
  for(let i=0;i<=rings;i++) {
    const t=Math.pow(i/rings,1.2);
    const radius=(.155-.075*t)+.006*Math.cos(i*Math.PI)+.16*Math.exp(-t*height*9);
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2;
      const rootLobe=1+.16*Math.sin(a*5+x+z)*Math.exp(-t*height*7);
      positions.push(x+leanX*t*t+Math.cos(a)*radius*rootLobe,base+(height+.14)*t,
        z+leanZ*t*t+Math.sin(a)*radius*rootLobe);
      if(i<rings&&j<sides) {
        const p=i*(sides+1)+j,q=p+sides+1;
        indices.push(p,q,p+1,p+1,q,q+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export function createIslandVegetation(materials:Set<THREE.Material>,geometries:Set<THREE.BufferGeometry>) {
  const group=new THREE.Group();group.name='island-vegetation';
  const leaves:LeafMesh={positions:[],colors:[],indices:[]};
  const trunks:THREE.BufferGeometry[]=[],stems:THREE.BufferGeometry[]=[];
  for(const palm of islandPalms) {
    trunks.push(trunk(palm.x,palm.z,palm.height,palm.leanX,palm.leanZ));
    for(let i=0;i<7;i++) {
      const angle=i*2.39996+palm.seed,length=.32+variation(i+palm.seed)*.28;
      const points=Array.from({length:9},(_,j)=>{
        const t=j/8,r=.1+t*length;
        const x=palm.x+Math.cos(angle)*r,z=palm.z+Math.sin(angle)*r;
        return new THREE.Vector3(x,terrainHeight(x,z)+.08*(1-t)-.07*t*t,z);
      });
      const root=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,.027,6,false);
      root.deleteAttribute('uv');trunks.push(root);
    }
    const crown=new THREE.Vector3(palm.x+palm.leanX,terrainHeight(palm.x,palm.z)+palm.height-.06,palm.z+palm.leanZ);
    for(let i=0;i<16;i++) {
      const seed=palm.seed+i*13,angle=i*2.39996+palm.seed;
      const young=i>11,length=palm.crown*(young?.6:.85+variation(seed)*.25);
      frond(leaves,stems,crown,angle,length,young?length*.85:length*.28,young?length*.12:length*.55,seed);
    }
  }
  for(const plant of islandUnderstory) {
    const base=new THREE.Vector3(plant.x,terrainHeight(plant.x,plant.z)-.045,plant.z);
    for(let i=0;i<9;i++) {
      const length=plant.scale*(.8+variation(plant.seed+i)*.5);
      frond(leaves,stems,base,i*2.39996+plant.seed,length,length*.8,length*.3,plant.seed+i,true);
    }
    for(let i=0;i<18;i++) {
      const angle=i*2.39996,spread=plant.scale*.4;
      const start=base.clone().add(new THREE.Vector3(Math.cos(angle)*spread,0,Math.sin(angle)*spread));
      start.y=terrainHeight(start.x,start.z)-.025;
      const end=start.clone().add(new THREE.Vector3(Math.cos(angle)*spread,plant.scale*(.35+variation(i)*.5),Math.sin(angle)*spread));
      blade(leaves,start,end,.025,plant.seed+i);
    }
    if(plant.seed%2===0) for(let i=0;i<22;i++) {
      const angle=i*2.39996,spread=plant.scale*(.35+variation(i)*.4);
      const start=base.clone();
      const end=base.clone().add(new THREE.Vector3(Math.cos(angle)*spread,
        plant.scale*(.42+variation(i+9)*.55),Math.sin(angle)*spread));
      blade(leaves,start,end,plant.scale*.095,plant.seed+i*3);
    }
  }
  for(const patch of [...islandPalms.map(p=>({x:p.x,z:p.z,scale:.75,seed:p.seed})),...islandUnderstory]) {
    for(let i=0;i<9;i++) {
      const angle=i*2.39996+patch.seed,r=(.2+variation(i+patch.seed)*.55)*patch.scale;
      const x=patch.x+Math.cos(angle)*r,z=patch.z+Math.sin(angle)*r;
      const length=.12+variation(i+21)*.14;
      const start=new THREE.Vector3(x,terrainHeight(x,z)+.008,z);
      const end=start.clone().add(new THREE.Vector3(Math.cos(angle+.7)*length,0,Math.sin(angle+.7)*length));
      end.y=terrainHeight(end.x,end.z)+.025;
      blade(leaves,start,end,.018,i+patch.seed,true);
    }
  }
  const bark=new THREE.MeshStandardMaterial({color:0x8d8066,roughness:.96});
  bark.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec3 vBark;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvBark=position;');
    shader.fragmentShader=`varying vec3 vBark;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
      float band=sin(vBark.y*83.0+sin(vBark.x*19.0+vBark.z*17.0)*.65);
      float fiber=sin(vBark.x*143.0+vBark.z*131.0+sin(vBark.y*7.0));
      diffuseColor.rgb*=.87+.11*band+.045*fiber;`);
  };
  const foliage=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.82});
  foliage.shadowSide=THREE.BackSide;
  const stemMaterial=new THREE.MeshStandardMaterial({color:0x65763a,roughness:.9});
  const leafGeometry=new THREE.BufferGeometry();
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leaves.positions,3));
  leafGeometry.setAttribute('color',new THREE.Float32BufferAttribute(leaves.colors,3));
  leafGeometry.setIndex(leaves.indices);leafGeometry.computeVertexNormals();
  const trunkGeometry=mergeGeometries(trunks)!,stemGeometry=mergeGeometries(stems)!;
  [...trunks,...stems].forEach(geometry=>geometry.dispose());
  for(const [geometry,material] of [[trunkGeometry,bark],[leafGeometry,foliage],[stemGeometry,stemMaterial]] as const) {
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=material!==foliage;
    group.add(mesh);geometries.add(geometry);materials.add(material);
  }
  return group;
}
