import * as THREE from 'three';

/** Build once from the actual cushion triangles; no per-frame collision work. */
export function loungeHeightSampler(geometry:THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!,size=32,bins:number[][]=Array.from({length:size*size},()=>[]);
  const position=geometry.attributes.position,index=geometry.index;
  const cellX=(x:number)=>Math.max(0,Math.min(size-1,Math.floor((x-bounds.min.x)/(bounds.max.x-bounds.min.x)*size)));
  const cellZ=(z:number)=>Math.max(0,Math.min(size-1,Math.floor((z-bounds.min.z)/(bounds.max.z-bounds.min.z)*size)));
  const vertex=(i:number)=>index?index.getX(i):i;
  const count=index?.count??position.count;
  for(let i=0;i<count;i+=3){
    const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
    const xs=[position.getX(a),position.getX(b),position.getX(c)],zs=[position.getZ(a),position.getZ(b),position.getZ(c)];
    for(let z=cellZ(Math.min(...zs));z<=cellZ(Math.max(...zs));z++)
      for(let x=cellX(Math.min(...xs));x<=cellX(Math.max(...xs));x++)bins[z*size+x].push(i);
  }
  return (x:number,z:number)=>{
    let height=-Infinity;
    for(const i of bins[cellZ(z)*size+cellX(x)]){
      const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
      const ax=position.getX(a),az=position.getZ(a),bx=position.getX(b),bz=position.getZ(b),cx=position.getX(c),cz=position.getZ(c);
      const determinant=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
      if(Math.abs(determinant)<1e-12)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/determinant;
      const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/determinant;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)
        height=Math.max(height,u*position.getY(a)+v*position.getY(b)+(1-u-v)*position.getY(c));
    }
    return height;
  };
}

/** A static resting pose: follow the local seat slope, then lift the complete
 * rigid controller until its lowest contact clears the unchanged cushion. */
export function restControllerOnLounge(controller:THREE.Group,cushion:THREE.Mesh,x:number,z:number,yaw:number) {
  const height=loungeHeightSampler(cushion.geometry),epsilon=.07;
  const dx=(height(x+epsilon,z)-height(x-epsilon,z))/(2*epsilon);
  const dz=(height(x,z+epsilon)-height(x,z-epsilon))/(2*epsilon);
  const normal=new THREE.Vector3(-dx,1,-dz).normalize();
  controller.position.set(x,0,z);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  controller.rotateY(yaw);controller.updateMatrixWorld(true);
  const point=new THREE.Vector3();let lift=-Infinity;
  controller.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const position=object.geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);
      lift=Math.max(lift,height(point.x,point.z)-point.y);
    }
  });
  if(!Number.isFinite(lift))throw new Error('Controller must rest within the cushion surface');
  controller.position.y=lift+.004;
  cushion.add(controller);
}
