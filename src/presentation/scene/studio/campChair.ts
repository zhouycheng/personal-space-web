import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {StudioPrimitives} from './studioPrimitives.ts';
import {createCampCanvas,campCanvasPoint} from './leisureGeometry.ts';

/** Joinery, tensioned canvas and rounded hardwood slats, in the existing chair footprint. */
export function createCampChair(p:StudioPrimitives,g:THREE.Group,wood:THREE.Material,canvas:THREE.Material,metal:THREE.Material,seam:THREE.Material) {
  const up=new THREE.Vector3(0,1,0);
  function slat(a:number[],b:number[],width=.047,depth=.055){
    const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...b as [number,number,number]);
    const m=p.mesh(g,new RoundedBoxGeometry(width,start.distanceTo(end)+.025,depth,5,.013),wood,...start.clone().add(end).multiplyScalar(.5).toArray() as [number,number,number]);
    m.quaternion.setFromUnitVectors(up,end.sub(start).normalize());return m;
  }
  function cord(parent:THREE.Object3D,points:THREE.Vector3[],r:number,material:THREE.Material){return p.mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(3,points.length),r,8,false),material,0,0,0);}
  for(const side of [-1,1]) {
    slat([side*.345,.025,-.35],[side*.345,.52,.30]);
    slat([side*.375,.025,.35],[side*.375,.995,-.33],.044,.059);
    slat([side*.355,.43,.21],[side*.355,.68,.18],.035,.041);
    const arm=p.mesh(g,new RoundedBoxGeometry(.085,.040,.64,6,.019),wood,side*.355,.70,-.025);arm.rotation.x=.045;
    // Rounded hinge plates sit between the crossing slats, with recessed screw slots.
    for(const [y,z] of [[.345,.10],[.685,.18]]){
      const washer=p.mesh(g,new THREE.CylinderGeometry(.024,.024,.007,32),metal,side*.405,y,z);washer.rotation.z=Math.PI/2;
      const screw=p.mesh(g,new THREE.SphereGeometry(.011,20,12),p.brass,side*.410,y,z);screw.scale.set(.35,1,1);
      p.box(g,[.001,.013,.0018],[side*.415,y,z],metal);
    }
    for(const z of [-.35,.35])p.mesh(g,new RoundedBoxGeometry(.061,.025,.069,4,.010),metal,side*(z<0?.345:.375),.017,z);
  }
  for(const [y,z] of [[.485,.28],[.485,-.28],[.965,-.33],[.15,-.28]])slat([-.35,y,z],[.35,y,z],.032,.038);
  for(const back of [false,true]){
    const panel=p.mesh(g,createCampCanvas(back),canvas,0,back?.76:.50,back?-.29:0);
    // Fine rolled hems follow the same deformed surface as the fabric.
    for(const side of [-1,1]) {
      cord(panel,Array.from({length:49},(_,i)=>campCanvasPoint(side*.319,(i/48-.5)*(back?.43:.56),back,.005)),.0038,canvas);
      cord(panel,Array.from({length:49},(_,i)=>campCanvasPoint((i/48-.5)*.638,side*(back?.209:.273),back,.005)),.0038,canvas);
      for(let i=0;i<35;i++){
        const t=(i+.2)/35-.5,span=back?.408:.538;
        const a=campCanvasPoint(side*.304,t*span,back,.006),b=campCanvasPoint(side*.304,(t+.012)*span,back,.006);
        cord(panel,[a,a.clone().lerp(b,.5),b],.0007,seam);
      }
    }
  }
  // Fabric sleeves wrap the upper rail instead of ending as a square slab.
  for(const x of [-.30,.30]){
    const sleeve=p.mesh(g,new THREE.TorusGeometry(.025,.006,8,32),canvas,x,.968,-.315);sleeve.rotation.y=Math.PI/2;sleeve.scale.z=2.4;
  }
}
