import { generateSceneGeometry } from './generateSceneGeometry.ts';
import { packSceneGeometry,sceneGeometryTransfers } from './sceneGeometryData.ts';

self.onmessage=async()=>{
  self.postMessage({started:true});
  try {
    const timings:Record<string,number>={};
    const data=await generateSceneGeometry(()=>Promise.resolve(),timings);
    const packet=packSceneGeometry(data);
    self.postMessage({packet,timings},{transfer:sceneGeometryTransfers(packet)});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
