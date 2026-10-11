export type OceanAudioState='paused'|'loading'|'playing'|'blocked'|'error';

/** One decoded loop and one source per shell; suspension freezes its playback position. */
export function createOceanAudio(changed:(state:OceanAudioState)=>void) {
  let context:AudioContext|undefined,gain:GainNode|undefined,source:AudioBufferSourceNode|undefined;
  let buffer:Promise<AudioBuffer>|undefined;
  let active=false,volume=.2,failed=false,disposed=false,version=0,timer=0;
  let state:OceanAudioState='paused';
  const fetchLifetime=new AbortController();
  const emit=(next:OceanAudioState)=>{if(!disposed&&state!==next){state=next;changed(next);}};
  function getContext() {
    if(!context) {
      context=new AudioContext({latencyHint:'playback',sampleRate:32000});
      gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
      context.addEventListener('statechange',()=>{
        if(disposed||!active)return;
        if(context?.state==='running')void start();else if(state==='playing')emit('blocked');
      });
    }
    return context;
  }
  function ramp(value:number,duration:number) {
    if(!context||!gain)return;
    const parameter=gain.gain,time=context.currentTime;
    parameter.cancelAndHoldAtTime(time);
    parameter.setValueAtTime(parameter.value,time);
    parameter.linearRampToValueAtTime(value*.5,time+duration);
  }
  async function start() {
    if(disposed||!active||failed)return;
    const token=++version;clearTimeout(timer);
    try {
      const ctx=getContext();
      if(ctx.state!=='running'){emit('blocked');return;}
      if(source&&state==='playing')return;
      if(!source) {
        emit('loading');
        buffer??=fetch('/audio/ocean.m4a',{signal:fetchLifetime.signal}).then(response=>{
          if(!response.ok)throw Error('Ocean audio unavailable');return response.arrayBuffer();
        }).then(bytes=>ctx.decodeAudioData(bytes));
        const decoded=await buffer;
        if(disposed||token!==version||!active)return;
        source=ctx.createBufferSource();source.buffer=decoded;source.loop=true;
        source.connect(gain!);source.start();
      }
      ramp(volume,2.5);emit('playing');
    } catch {
      if(disposed||token!==version)return;
      failed=true;buffer=undefined;emit('error');void context?.suspend().catch(()=>{});
    }
  }
  function resume() {
    if(disposed||failed)return;
    try {
      const ctx=getContext();
      // Called synchronously from the entrance/home gesture, before any fetch or await.
      void ctx.resume().then(()=>{
        if(disposed)return;
        if(active)void start();else void ctx.suspend().catch(()=>{});
      }).catch(()=>{if(active&&!disposed)emit('blocked');});
      if(active)void start();
    } catch {failed=true;emit('error');}
  }
  return {
    unlock:resume,
    setActive(value:boolean,immediate=false) {
      if(disposed||(value===active&&!(immediate&&!value)))return;
      active=value;const token=++version;clearTimeout(timer);
      if(active){resume();return;}
      ramp(0,immediate?0:.4);
      const pause=()=>{
        if(disposed||token!==version||active)return;
        void context?.suspend().then(()=>{if(active)resume();}).catch(()=>{});
      };
      if(immediate)pause();else timer=window.setTimeout(pause,400);
      emit(failed?'error':'paused');
    },
    setVolume(value:number) {
      if(!Number.isFinite(value))return;
      volume=Math.max(0,Math.min(1,value));
      if(active&&state==='playing')ramp(volume,.08);
    },
    retry(){failed=false;buffer=undefined;resume();},
    dispose() {
      if(disposed)return;disposed=true;active=false;version++;clearTimeout(timer);fetchLifetime.abort();
      source?.stop();source?.disconnect();gain?.disconnect();
      void context?.close().catch(()=>{});source=undefined;gain=undefined;buffer=undefined;context=undefined;
    },
  };
}
