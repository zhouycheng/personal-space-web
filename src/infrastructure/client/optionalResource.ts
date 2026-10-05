import { activeTimeout } from './activeDeadline.ts';

/** Optional visual detail cannot hold the entrance forever. Late success stays usable. */
export function waitForOptionalResource(resource:Promise<void>,signal:AbortSignal,milliseconds=15_000) {
  return new Promise<'ready'|'timeout'|'cancelled'>(resolve=>{
    let settled=false;
    const finish=(result:'ready'|'timeout'|'cancelled')=>{if(settled)return;settled=true;stop();signal.removeEventListener('abort',abort);resolve(result);};
    const abort=()=>finish('cancelled');
    const stop=activeTimeout(()=>finish('timeout'),milliseconds);
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();
    resource.then(()=>finish('ready'),()=>finish('ready'));
  });
}
