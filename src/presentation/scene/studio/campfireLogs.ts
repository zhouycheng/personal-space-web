import * as THREE from 'three';
import { campfireFuel, campfireLogOrder } from '../../../config/islandLeisure.ts';
import type { CampfireState, CampfireLayout, CampfirePlacement } from '../../../contracts/campfire.ts';
import type { StudioPrimitives } from './studioPrimitives.ts';
import { createCampfireWood, createSplitLogGeometry } from './campfireWood.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const bed=.045;
const sizes=[[.90,.155],[1.02,.14],[.76,.17]];
const candidates=[[-.04,-.20,1.32],[.06,.19,1.55],[-.07,0,-.48],[.26,-.07,.60],[-.29,.02,.45],[-.12,-.29,2.25],[.16,.29,2.75],[-.29,-.16,2.04],[.27,.16,2.14],[-.37,.13,-.28],[.36,-.12,-.12],[.03,-.39,1.5],[-.12,.40,1.9],[-.48,-.04,.13],[.47,.05,-.19],[.03,-.43,1.78],[-.05,.43,1.24]];
export type LogPose={center:THREE.Vector3;axis:THREE.Vector3;length:number;radius:number;progress:number};

function poseFor(placement:CampfirePlacement,age:number):LogPose {
  const progress=clamp(age/campfireFuel.burnSeconds),[length,radius]=sizes[placement.variant];
  const erosion=clamp((progress-.35)/.65);
  return {center:new THREE.Vector3(placement.x,bed,placement.z),axis:new THREE.Vector3(Math.sin(placement.angle),0,Math.cos(placement.angle)),
    length:length*(1-.24*erosion),radius:radius*(1-.64*erosion),progress};
}

/** Minimize the centre of mass while both ends clear the bed and older logs. */
function settle(log:LogPose,supports:(LogPose|undefined)[]) {
  const contacts=Array.from({length:21},(_,j)=>{
    const t=(j/20-.5)*log.length,bottom=log.radius*.72*(1-.17*Math.abs(t*2/log.length));
    const x=log.center.x+log.axis.x*t,z=log.center.z+log.axis.z*t;
    let height=bed;
    for(const support of supports)if(support) {
      const dx=x-support.center.x,dz=z-support.center.z,horizontal=Math.hypot(support.axis.x,support.axis.z);
      const along=(dx*support.axis.x+dz*support.axis.z)/horizontal,across=Math.abs(dx*support.axis.z-dz*support.axis.x)/horizontal;
      if(Math.abs(along)>support.length*.5*horizontal||across>support.radius*.87+log.radius*.35)continue;
      const top=.52*support.radius*(1-.17*Math.abs(along*2/support.length))*(1-.7*clamp((across-log.radius*.3)/support.radius));
      height=Math.max(height,support.center.y+along*support.axis.y/horizontal+top);
    }
    return {t,height:height+bottom};
  });
  let bestHeight=Infinity,bestSlope=0,bestScore=Infinity;
  for(let i=-16;i<=16;i++) {
    const slope=i*.02,height=Math.max(...contacts.map(c=>c.height-slope*c.t)),score=height+slope*slope*.015;
    if(score<bestScore){bestScore=score;bestHeight=height;bestSlope=slope;}
  }
  log.center.y=bestHeight;log.axis.y=bestSlope;log.axis.normalize();
}

function defaultLayout(ages:CampfireState['logs']):CampfireLayout {
  const logs:(CampfirePlacement|null)[]=Array(7).fill(null);
  let order=0;
  for(const slot of campfireLogOrder)if(ages[slot]!=null) {
    const [x,z,angle]=candidates[order%7];
    logs[slot]=order<3?{x,z,angle,order,variant:order%3}:nextPlacement(ages.map(age=>age===null?null:0),{logs,charcoal:[]},order);order++;
  }
  return {logs,charcoal:[]};
}

export function campfireLogPoses(ages:CampfireState['logs'],layout=defaultLayout(ages)) {
  const poses:(LogPose|undefined)[]=Array(7);
  const ordered=layout.logs.map((placement,slot)=>({placement,slot})).filter(item=>item.placement&&ages[item.slot]!=null)
    .sort((a,b)=>a.placement!.order-b.placement!.order);
  for(const {placement,slot} of ordered) {
    const pose=poseFor(placement!,ages[slot]!);settle(pose,poses);
    poses[slot]=pose;
  }
  return poses;
}

function nextPlacement(ages:CampfireState['logs'],layout:CampfireLayout,order:number):CampfirePlacement {
  const variant=order%3,supports=campfireLogPoses(ages,layout);
  let best:CampfirePlacement|undefined,bestScore=Infinity;
  for(let i=0;i<candidates.length;i++) {
    const [x,z,angle]=candidates[(i+order)%candidates.length],candidate={x,z,angle,order,variant};
    if(layout.logs.some(log=>log&&Math.hypot(log.x-x,log.z-z)<.1&&Math.abs(Math.sin(log.angle-angle))<.4))continue;
    const pose=poseFor(candidate,0);settle(pose,supports);
    const parallel=layout.logs.reduce((sum,log)=>sum+(log?Math.pow(Math.cos(log.angle-angle),8)*Math.exp(-Math.hypot(log.x-x,log.z-z)/.4):0),0);
    const score=pose.center.y+parallel*.09;
    if(score<bestScore){bestScore=score;best=candidate;}
  }
  return best??{x:0,z:0,angle:order*.73,order,variant};
}

export function createCampfireLogs(p:StudioPrimitives,parent:THREE.Group,materials:Set<THREE.Material>,textures:Set<THREE.Texture>,geometries:Set<THREE.BufferGeometry>) {
  const group=new THREE.Group();group.name='campfire-logs';parent.add(group);
  const wood=createCampfireWood(materials,textures);
  const shapes=[0,1,2].map(variant=>{const geometry=createSplitLogGeometry(variant);geometries.add(geometry);return geometry;});
  const models=Array.from({length:7},(_,i)=>{
    const surface=wood.createSurface(),mesh=p.mesh(group,shapes[i%3],surface.material,0,0,0);mesh.name=`campfire-log-${i}`;
    return {mesh,surface,target:new THREE.Vector3(),scale:new THREE.Vector3(),rotation:new THREE.Quaternion(),drop:Infinity,progress:0};
  });
  const coalMaterial=p.material(0x292522,1),coalGeometry=new THREE.DodecahedronGeometry(1,0);geometries.add(coalGeometry);
  const debris=new THREE.InstancedMesh(coalGeometry,coalMaterial,14);debris.name='campfire-charcoal-fragments';debris.count=0;debris.castShadow=debris.receiveShadow=true;parent.add(debris);
  const transform=new THREE.Object3D(),across=new THREE.Vector3(),normal=new THREE.Vector3(),basis=new THREE.Matrix4();
  let layout:CampfireLayout={logs:Array(7).fill(null),charcoal:[]},previous:CampfireState['logs']=Array(7).fill(null),initialized=false;

  function updateDebris() {
    let count=0;
    for(const coal of layout.charcoal)for(const side of [-1,1]) {
      transform.position.set(coal.x+Math.sin(coal.angle)*side*.17,bed+.025,coal.z+Math.cos(coal.angle)*side*.17);
      transform.rotation.set(.12*side,coal.angle,.16*side);transform.scale.set(.09,.032,.15);
      transform.updateMatrix();debris.setMatrixAt(count++,transform.matrix);
    }
    debris.count=count;debris.instanceMatrix.needsUpdate=true;debris.computeBoundingSphere();
  }

  function place(slot:number,ages:CampfireState['logs']) {
    const old=layout.logs[slot];
    if(old) {
      const coal={x:old.x,z:old.z,angle:old.angle};
      if(layout.charcoal.length<7)layout.charcoal.push(coal);else layout.charcoal[old.order%7]=coal;
    }
    layout.logs[slot]=null;
    const order=Math.max(-1,...layout.logs.map(log=>log?.order??-1))+1;
    layout.logs[slot]=nextPlacement(ages,layout,order);updateDebris();
  }

  function update(state:CampfireState,animate=false) {
    if(!initialized)layout=defaultLayout(state.logs);
    state.logs.forEach((age,i)=>{
      if(age==null){layout.logs[i]=null;return;}
      if(initialized&&(previous[i]==null||age<previous[i]!)) {
        place(i,state.logs);
        const remaining=models.reduce((value,model)=>Math.max(value,Number.isFinite(model.drop)?.24-model.drop:0),0);
        models[i].drop=animate?-remaining:Infinity;
      }
    });
    const poses=campfireLogPoses(state.logs,layout);
    models.forEach((model,i)=>{
      const pose=poses[i];model.mesh.visible=Boolean(pose);if(!pose){model.drop=Infinity;return;}
      const placement=layout.logs[i]!;model.mesh.geometry=shapes[placement.variant];
      model.target.copy(pose.center);model.scale.set(pose.radius,pose.length,pose.radius);
      across.set(-pose.axis.z,0,pose.axis.x).normalize();normal.crossVectors(across,pose.axis);
      basis.makeBasis(across,pose.axis,normal);model.rotation.setFromRotationMatrix(basis);
      model.surface.pose.value.compose(model.target,model.rotation,model.scale);
      model.progress=pose.progress;model.surface.burn.value=pose.progress;
      model.surface.heat.value=Math.min(1,(state.logs[i]??0)/8)*(.35+.65*(1-pose.progress));
      model.mesh.morphTargetInfluences![0]=clamp((pose.progress-.62)/.38);
      if(!initialized||!animate){model.drop=Infinity;model.mesh.position.copy(model.target);model.mesh.scale.copy(model.scale);model.mesh.quaternion.copy(model.rotation);}
      model.mesh.userData.burn=pose.progress;
    });
    previous=[...state.logs];initialized=true;
  }

  return {group,debris,update,load:wood.load,
    tick(seconds:number) {
      let moving=false;
      for(const model of models)if(model.mesh.visible||Number.isFinite(model.drop)) {
        if(Number.isFinite(model.drop)) {
          model.drop+=seconds;const t=clamp(model.drop/.62);model.mesh.visible=model.drop>=0;
          model.mesh.position.copy(model.target);model.mesh.position.y+=.48*(1-t*t);
          model.mesh.quaternion.copy(model.rotation);model.mesh.rotateY((1-t)*.16);model.mesh.scale.copy(model.scale);
          if(t===1)model.drop=Infinity;else moving=true;
        } else {
          const amount=1-Math.exp(-seconds*5);
          if(model.mesh.position.distanceToSquared(model.target)>1e-9||model.mesh.scale.distanceToSquared(model.scale)>1e-9||model.mesh.quaternion.angleTo(model.rotation)>1e-5) {
            model.mesh.position.lerp(model.target,amount);model.mesh.scale.lerp(model.scale,amount);model.mesh.quaternion.slerp(model.rotation,amount);moving=true;
          }
        }
      }
      return moving;
    },
    snapshot():CampfireLayout {return {logs:layout.logs.map(log=>log?{...log}:null),charcoal:layout.charcoal.map(coal=>({...coal}))};},
    restore(state:CampfireState,saved?:CampfireLayout) {
      initialized=false;update(state);
      const valid=(value:{x:number;z:number;angle:number})=>value&&[value.x,value.z,value.angle].every(Number.isFinite)&&Math.abs(value.x)<=.6&&Math.abs(value.z)<=.6&&Math.abs(value.angle)<Math.PI*8;
      if(saved?.logs?.length===7&&saved.logs.every(log=>log===null||(valid(log)&&Number.isInteger(log.variant)&&log.variant>=0&&log.variant<3&&Number.isInteger(log.order)&&log.order>=0&&log.order<1e9))) {
        layout.logs=saved.logs.map((log,i)=>state.logs[i]!=null&&log?{...log}:layout.logs[i]);
        layout.charcoal=Array.isArray(saved.charcoal)?saved.charcoal.filter(valid).slice(0,7).map(coal=>({...coal})):[];
        update(state);updateDebris();
      }
    },
    dispose(){wood.dispose();debris.dispose();},
  };
}
