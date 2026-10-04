/** Two frames give a changed status a paint before the next synchronous task. */
export function paintOpportunity(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let frame=0;
    const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
    const abort=()=>{cancelAnimationFrame(frame);signal?.removeEventListener('abort',abort);reject(new DOMException('Preparation cancelled','AbortError'));};
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(finish);});
  });
}
