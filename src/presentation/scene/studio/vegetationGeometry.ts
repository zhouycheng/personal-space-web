import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { islandPalms,islandUnderstory } from '../../../config/islandVegetation.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';
import { dressingPlants } from '../../../config/islandDressing.ts';
import { emptyLeaves,createLeafDetails,type LeafMesh } from './leafDetails.ts';

const variation=(seed:number)=>{const x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function windAnchor(geometry:THREE.BufferGeometry,origin:THREE.Vector3) {
  const values=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<values.length;i+=3){values[i]=origin.x;values[i+1]=origin.y;values[i+2]=origin.z;}
  geometry.setAttribute('windAnchor',new THREE.BufferAttribute(values,3));
}

/** Curved, folded leaflets model the silhouette and cast individual leaf shadows. */
function blade(mesh:LeafMesh,start:THREE.Vector3,end:THREE.Vector3,width:number,seed:number,dry=false,anchor=start) {
  const offset=mesh.positions.length/3,broad=width>.12,segments=broad?22:8,columns=broad?9:5;
  mesh.blades.push({offset,segments,columns});
  const direction=end.clone().sub(start);
  const side=new THREE.Vector3(-direction.z,0,direction.x).normalize();
  const green=dry?new THREE.Color(0x786344):new THREE.Color().setHSL(.25+variation(seed)*.045,.48+variation(seed+1)*.15,.23+variation(seed+2)*.09).convertSRGBToLinear();
  for(let i=0;i<=segments;i++) {
    const t=i/segments;
    const center=start.clone().addScaledVector(direction,t);
    center.y+=Math.sin(t*Math.PI)*direction.length()*.11-t*t*direction.length()*.12;
    const span=width*Math.pow(Math.sin(Math.PI*t),.82)*(1+.045*Math.sin(t*39+seed));
    for(let j=0;j<columns;j++) {
      const edge=j/(columns-1)*2-1;
      const point=center.clone().addScaledVector(side,span*edge);
      point.y+=span*(broad?.19:.24)*(1-edge*edge)+edge*span*.12*Math.sin(t*5+seed);
      mesh.positions.push(point.x,point.y,point.z);
      mesh.uvs.push(j/(columns-1),t);
      mesh.anchors.push(anchor.x,anchor.y,anchor.z);
      const color=green.clone().multiplyScalar((1-.12*Math.abs(edge))*(1+.1*t)+.025*Math.sin(t*24+seed));
      mesh.colors.push(color.r,color.g,color.b);
    }
    if(i<segments) for(let edge=0;edge<columns-1;edge++) {
      const a=offset+i*columns+edge,b=a+columns;
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
  windAnchor(stem,origin);
  stem.deleteAttribute('uv');stems.push(stem);
  const pairs=fern?23:29;
  for(let i=0;i<pairs;i++) {
    const t=.12+i/(pairs-1)*.83;
    for(const sign of [-1,1]) {
      const localSeed=seed+i*7+sign;
      const start=center(t+(sign===1?.008:0));
      const spread=length*(fern?.23:.28)*Math.pow(Math.sin(Math.PI*t),.8)*( .85+variation(localSeed)*.25);
      const end=start.clone().addScaledVector(across,sign*spread)
        .addScaledVector(along,spread*(.35+variation(localSeed+3)*.3));
      end.y-=spread*(.35+variation(localSeed+4)*.3);
      blade(mesh,start,end,length*(fern?.023:.025)*(1-.65*t),localSeed,false,origin);
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

export function createVegetationGeometry() {
  let leaves=emptyLeaves();
  const plants:LeafMesh[]=[];
  const plant=()=>{leaves=emptyLeaves();plants.push(leaves);};
  const trunks:THREE.BufferGeometry[]=[],stems:THREE.BufferGeometry[]=[];
  for(const palm of islandPalms) {
    plant();
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
    leaves=emptyLeaves();plants.push(leaves);
    const base=new THREE.Vector3(plant.x,terrainHeight(plant.x,plant.z)-.045,plant.z);
    for(let i=0;i<14;i++) {
      const seed=plant.seed+i*17,length=plant.scale*(.58+variation(seed)*.72),angle=i*2.39996+plant.seed;
      const root=base.clone().add(new THREE.Vector3(Math.cos(angle)*plant.scale*.12,0,Math.sin(angle)*plant.scale*.12));
      root.y=terrainHeight(root.x,root.z)-.04;
      frond(leaves,stems,root,angle,length,length*(.5+variation(seed+1)*.45),length*(.24+variation(seed+2)*.24),seed,true);
    }
    for(let i=0;i<85;i++) {
      const seed=plant.seed*13+i*7,angle=i*2.39996+plant.seed,spread=plant.scale*(.15+Math.sqrt(variation(seed))*.58);
      const start=base.clone().add(new THREE.Vector3(Math.cos(angle)*spread,0,Math.sin(angle)*spread));
      start.y=terrainHeight(start.x,start.z)-.025;
      const bend=angle+.9*(variation(seed+1)-.5),reach=plant.scale*(.1+variation(seed+2)*.26);
      const end=start.clone().add(new THREE.Vector3(Math.cos(bend)*reach,plant.scale*(.18+variation(seed+3)*.38),Math.sin(bend)*reach));
      blade(leaves,start,end,.005+variation(seed+4)*.008,seed,i%19===0);
    }
    if(plant.seed%2===0) for(let i=0;i<22;i++) {
      const angle=i*2.39996,spread=plant.scale*(.35+variation(i)*.4);
      const start=base.clone();
      const end=base.clone().add(new THREE.Vector3(Math.cos(angle)*spread,
        plant.scale*(.42+variation(i+9)*.55),Math.sin(angle)*spread));
      blade(leaves,start,end,plant.scale*.095,plant.seed+i*3);
    }
  }
  // Upright petioles and broad folded leaves add a middle layer beneath the palms.
  for(const plant of dressingPlants) {
    leaves=emptyLeaves();plants.push(leaves);
    const origin=new THREE.Vector3(plant.x,terrainHeight(plant.x,plant.z)-.035,plant.z);
    for(let i=0;i<11;i++) {
      const seed=plant.seed+i*11,angle=i*2.39996+plant.seed,young=i>7;
      const spread=plant.radius*(young?.12:.2+.06*variation(seed));
      const tip=origin.clone().add(new THREE.Vector3(Math.cos(angle)*spread,plant.height*(young?.48:.22+.1*variation(seed+1)),Math.sin(angle)*spread));
      const mid=origin.clone().lerp(tip,.55);mid.y+=.14;
      const stem=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([origin,mid,tip]),12,.013,5,false);
      windAnchor(stem,origin);
      stem.deleteAttribute('uv');stems.push(stem);
      const reach=plant.radius*(young?.35:.8+.08*variation(seed+2));
      const end=origin.clone().add(new THREE.Vector3(Math.cos(angle)*reach,plant.height*(young?1:.66+.25*variation(seed+3)),Math.sin(angle)*reach));
      blade(leaves,tip,end,plant.radius*(young?.16:.26),seed,false,origin);
    }
  }
  plant();
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
  const details=plants.map(createLeafDetails);
  const trunkGeometry=mergeGeometries(trunks)!,stemGeometry=mergeGeometries(stems)!;
  [...trunks,...stems].forEach(geometry=>geometry.dispose());
  return {details,trunkGeometry,stemGeometry};
}
export type VegetationGeometry=ReturnType<typeof createVegetationGeometry>;
