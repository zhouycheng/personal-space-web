import * as THREE from 'three';
import type { VegetationGeometry } from './vegetationGeometry.ts';

export type PreparedSceneGeometry={sand:THREE.BufferGeometry;water:THREE.BufferGeometry;rocks:THREE.BufferGeometry;vegetation:VegetationGeometry;rockSections:Uint16Array};
type AttributeData={array:THREE.TypedArray;itemSize:number;normalized:boolean};
type GeometryData={attributes:Record<string,number>;index?:number;box?:number[][];sphere?:{center:number[];radius:number}};
export type SceneGeometryPacket={attributes:AttributeData[];geometries:GeometryData[];sand:number;water:number;rocks:number;trunk:number;stem:number;leaves:{geometry:number;error:number}[][];rockSections:Uint16Array};

export function packSceneGeometry(data:PreparedSceneGeometry):SceneGeometryPacket {
  const attributes:AttributeData[]=[],geometries:GeometryData[]=[],ids=new Map<THREE.BufferAttribute,number>();
  const attribute=(value:THREE.BufferAttribute)=>{
    let id=ids.get(value);
    if(id===undefined){id=attributes.length;ids.set(value,id);attributes.push({array:value.array,itemSize:value.itemSize,normalized:value.normalized});}
    return id;
  };
  const geometry=(value:THREE.BufferGeometry)=>{
    const id=geometries.length;
    geometries.push({attributes:Object.fromEntries(Object.entries(value.attributes).map(([key,a])=>[key,attribute(a as THREE.BufferAttribute)])),index:value.index?attribute(value.index):undefined,
      box:value.boundingBox?[value.boundingBox.min.toArray(),value.boundingBox.max.toArray()]:undefined,
      sphere:value.boundingSphere?{center:value.boundingSphere.center.toArray(),radius:value.boundingSphere.radius}:undefined});
    return id;
  };
  return {attributes,geometries,rockSections:data.rockSections,sand:geometry(data.sand),water:geometry(data.water),rocks:geometry(data.rocks),trunk:geometry(data.vegetation.trunkGeometry),stem:geometry(data.vegetation.stemGeometry),
    leaves:data.vegetation.details.map(levels=>levels.map(level=>({geometry:geometry(level.geometry),error:level.error})))};
}

export function sceneGeometryTransfers(packet:SceneGeometryPacket) {
  return [...new Set([...packet.attributes.map(attribute=>attribute.array.buffer as ArrayBuffer),packet.rockSections.buffer as ArrayBuffer])];
}

export function unpackSceneGeometry(packet:SceneGeometryPacket):PreparedSceneGeometry {
  const attributes=packet.attributes.map(a=>new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
  const geometries=packet.geometries.map(g=>{
    const result=new THREE.BufferGeometry();
    for(const [key,id] of Object.entries(g.attributes))result.setAttribute(key,attributes[id]);
    if(g.index!==undefined)result.setIndex(attributes[g.index]);
    if(g.box)result.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(g.box[0]),new THREE.Vector3().fromArray(g.box[1]));
    if(g.sphere)result.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(g.sphere.center),g.sphere.radius);
    return result;
  });
  return {rockSections:packet.rockSections,sand:geometries[packet.sand],water:geometries[packet.water],rocks:geometries[packet.rocks],vegetation:{trunkGeometry:geometries[packet.trunk],stemGeometry:geometries[packet.stem],
    details:packet.leaves.map(levels=>levels.map(level=>{const geometry=geometries[level.geometry];geometry.userData.detailError=level.error;return {geometry,error:level.error};}))}};
}

export function disposePreparedGeometry(data:PreparedSceneGeometry) {
  for(const geometry of [data.sand,data.water,data.rocks,data.vegetation.trunkGeometry,data.vegetation.stemGeometry,...data.vegetation.details.flatMap(levels=>levels.map(l=>l.geometry))])geometry.dispose();
}
