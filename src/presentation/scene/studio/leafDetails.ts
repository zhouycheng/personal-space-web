import * as THREE from 'three';

export type LeafMesh = { positions:number[]; colors:number[]; indices:number[]; anchors:number[]; uvs:number[];
  blades:{offset:number;segments:number;columns:number}[] };
export const emptyLeaves = ():LeafMesh => ({positions:[],colors:[],indices:[],anchors:[],uvs:[],blades:[]});

type LeafTemplate = { indices:number[]; samples:[number,number,number,number,number,number,number][] };
const templates=new Map<string,LeafTemplate>();
const range=(last:number,stride:number)=>{const a=[];for(let i=0;i<last;i+=stride)a.push(i);a.push(last);return a;};

/** Topology and barycentric weights depend on the grid, never the leaf's shape. */
function leafTemplate(segments:number,columns:number,stride:number) {
  const key=`${segments}:${columns}:${stride}`,cached=templates.get(key);
  if(cached)return cached;
  const template:LeafTemplate={indices:[],samples:[]};
  const triangle=(ax:number,ay:number,bx:number,by:number,cx:number,cy:number)=>{
    const a=ay*columns+ax,b=by*columns+bx,c=cy*columns+cx;
    template.indices.push(a,b,c);
    const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    for(let y=Math.min(ay,by,cy);y<=Math.max(ay,by,cy);y++)for(let x=Math.min(ax,bx,cx);x<=Math.max(ax,bx,cx);x++) {
      const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-8)template.samples.push([a,b,c,y*columns+x,u,v,w]);
    }
  };
  const cols=range(columns-1,columns<=5?2:stride);
  for(let c=0;c<cols.length-1;c++) {
    const left=cols[c],right=cols[c+1],interiorStride=columns<=5?stride/2:stride;
    const a=range(segments,left===0?1:interiorStride),b=range(segments,right===columns-1?1:interiorStride);
    let i=0,j=0;
    while(i<a.length-1||j<b.length-1) {
      if(i<a.length-1&&(j===b.length-1||a[i+1]<=b[j+1])){triangle(left,a[i],left,a[i+1],right,b[j]);i++;}
      else {triangle(left,a[i],right,b[j+1],right,b[j]);j++;}
    }
  }
  templates.set(key,template);return template;
}

/** Reuse original vertices/normals/UVs. Each level contains every leaf, including its tips. */
export function createLeafDetails(leaves:LeafMesh) {
  const full=new THREE.BufferGeometry();
  full.setAttribute('position',new THREE.Float32BufferAttribute(leaves.positions,3));
  full.setAttribute('color',new THREE.Float32BufferAttribute(leaves.colors,3));
  full.setAttribute('leafUv',new THREE.Float32BufferAttribute(leaves.uvs,2));
  full.setAttribute('windAnchor',new THREE.Float32BufferAttribute(leaves.anchors,3));
  full.setIndex(leaves.indices);full.computeVertexNormals();full.computeBoundingBox();full.computeBoundingSphere();
  let maximumReachSquared=0;
  for(let i=0;i<leaves.positions.length;i+=3) {
    let reach=0;for(let axis=0;axis<3;axis++)reach+=(leaves.positions[i+axis]-leaves.anchors[i+axis])**2;
    maximumReachSquared=Math.max(maximumReachSquared,reach);
  }
  // Global bound of the shared breeze + flutter displacement, including leaf tips.
  full.boundingSphere!.radius+=maximumReachSquared*(.024*1.176+.0025)*Math.hypot(.85,.18,.53);
  const levels=[{geometry:full,error:0}];
  for(const stride of [2,4]) {
    const indices:number[]=[];let error=0;
    for(const {offset,segments,columns} of leaves.blades) {
      const template=leafTemplate(segments,columns,stride);
      for(const index of template.indices)indices.push(offset+index);
      for(const [a,b,c,source,u,v,w] of template.samples) {
        let distance=0;
        for(let axis=0;axis<3;axis++) {
          const p=leaves.positions,interpolated=p[(offset+a)*3+axis]*u+p[(offset+b)*3+axis]*v+p[(offset+c)*3+axis]*w;
          distance+=(p[(offset+source)*3+axis]-interpolated)**2;
        }
        error=Math.max(error,Math.sqrt(distance));
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.attributes=full.attributes;geometry.setIndex(indices);
    geometry.boundingBox=full.boundingBox!.clone();geometry.boundingSphere=full.boundingSphere!.clone();
    // Margin for wind deformation and crossings of the fine/coarse triangulations.
    geometry.userData.detailError=error*2;
    levels.push({geometry,error:error*2});
  }
  return levels;
}

/** Enter coarser geometry below .4 physical pixels, return to fine by .5 pixels. */
export function leafDetailLevel(errors:readonly number[],pixelsPerUnit:number,current:number,shadowPixelsPerUnit=2048/24) {
  let level=0;
  for(let i=1;i<errors.length;i++) {
    const limit=i>current?.4:.5;
    if(errors[i]*pixelsPerUnit<=limit&&errors[i]*shadowPixelsPerUnit<=1)level=i;
  }
  return level;
}
