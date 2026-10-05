import { generateSceneGeometry } from './generateSceneGeometry.ts';
import { unpackSceneGeometry,type SceneGeometryPacket } from './sceneGeometryData.ts';
import { paintOpportunity } from '../../../infrastructure/client/paintOpportunity.ts';
import { activeTimeout } from '../../../infrastructure/client/activeDeadline.ts';

export async function prepareSceneGeometry(signal:AbortSignal,timings:Record<string,number>,onStarted:()=>void=()=>{}) {
  const start=performance.now();
  try {
    const result=await new Promise<{packet:SceneGeometryPacket;timings:Record<string,number>}>((resolve,reject)=>{
      if(signal.aborted){reject(new DOMException('Preparation cancelled','AbortError'));return;}
      const worker=new Worker(new URL('./scenePreparation.worker.ts',import.meta.url),{type:'module'});
      const cleanup=()=>{worker.terminate();stop();signal.removeEventListener('abort',abort);};
      const fail=(error:unknown)=>{cleanup();reject(error);};
      const abort=()=>fail(new DOMException('Preparation cancelled','AbortError'));
      const stop=activeTimeout(()=>fail(new Error('Geometry worker timed out')),30_000);
      signal.addEventListener('abort',abort,{once:true});
      worker.onmessage=event=>{if(event.data.started){timings.workerStartWait=performance.now()-start;onStarted();return;}if(event.data.error){fail(new Error(event.data.error));return;}cleanup();resolve(event.data);};
      worker.onerror=event=>{event.preventDefault();fail(new Error(event.message));};
      worker.onmessageerror=()=>fail(new Error('Geometry worker message could not be decoded'));
      try{worker.postMessage({});}catch(error){fail(error);}
    });
    timings.geometryWorker=performance.now()-start;Object.assign(timings,result.timings);
    return unpackSceneGeometry(result.packet);
  }catch(error){
    onStarted();
    if(signal.aborted)throw error;
    timings.workerFallback=1;
    return generateSceneGeometry(()=>paintOpportunity(signal),timings);
  }
}
