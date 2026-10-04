import type { FlowNode, FlowEdge } from './flowTypes.ts';
import { inferHandlePair } from '../../interaction/canvas/mineCanvasGeometry.ts';

/** Retain unrelated edge objects while a local node moves. */
export function createEdgeDeriver(seed: readonly FlowEdge[]) {
  const nodeById=new Map<string,FlowNode>(),adjacent=new Map<string,number[]>();
  let edges=seed.map(edge=>({...edge,selectable:false,reconnectable:false}));
  seed.forEach((edge,index)=>{for(const id of [edge.source,edge.target]){const list=adjacent.get(id)??[];list.push(index);adjacent.set(id,list);}});
  return (nodes:FlowNode[])=>{
    const dirty=new Set<number>(),present=new Set<string>();
    for(const node of nodes){
      present.add(node.id);const old=nodeById.get(node.id);
      if(!old||old.position.x!==node.position.x||old.position.y!==node.position.y||old.data.width!==node.data.width||old.data.height!==node.data.height)
        for(const index of adjacent.get(node.id)??[])dirty.add(index);
      nodeById.set(node.id,node);
    }
    for(const id of nodeById.keys())if(!present.has(id)){nodeById.delete(id);for(const index of adjacent.get(id)??[])dirty.add(index);}
    if(dirty.size){
      const next=edges.slice();
      for(const index of dirty){
        const edge=seed[index],a=nodeById.get(edge.source),b=nodeById.get(edge.target);
        const pair=a&&b?inferHandlePair({x:a.position.x+a.data.width/2,y:a.position.y+a.data.height/2},{x:b.position.x+b.data.width/2,y:b.position.y+b.data.height/2})
          :{sourceHandle:'right',targetHandle:'left'};
        const old=edges[index];
        if(old.sourceHandle!==pair.sourceHandle||old.targetHandle!==pair.targetHandle)next[index]={...old,...pair};
      }
      if(next.some((edge,i)=>edge!==edges[i]))edges=next;
    }
    return {nodeById,edges};
  };
}
