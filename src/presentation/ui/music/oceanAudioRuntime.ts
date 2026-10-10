import {createOceanAudio,type OceanAudioState} from '../../../infrastructure/client/oceanAudio';
import {readOceanAudioPreferences,saveOceanAudioPreferences} from '../../../infrastructure/client/oceanAudioPreferences';

export function createOceanAudioControls(root:HTMLElement) {
  const events=new AbortController(),{signal}=events;
  const toggle=root.querySelector<HTMLButtonElement>('[data-ocean-toggle]')!;
  const slider=root.querySelector<HTMLInputElement>('[data-ocean-volume]')!;
  const output=root.querySelector<HTMLOutputElement>('[data-ocean-output]')!;
  const status=root.querySelector<HTMLElement>('[data-ocean-status]')!;
  const retry=root.querySelector<HTMLButtonElement>('[data-ocean-retry]')!;
  const preferences=readOceanAudioPreferences();
  let available=false;
  function render(state:OceanAudioState) {
    root.dataset.state=state;
    toggle.setAttribute('aria-checked',String(preferences.enabled));
    slider.disabled=!preferences.enabled;slider.value=String(preferences.volume);
    output.value=`${Math.round(preferences.volume*100)}%`;slider.setAttribute('aria-valuetext',output.value);
    status.textContent=!preferences.enabled?'':state==='error'?'海浪声暂时无法播放':state==='blocked'?'点击页面后播放海浪声':state==='loading'?'正在加载海浪声…':'';
    status.hidden=!status.textContent;retry.hidden=state!=='error'||!preferences.enabled;
  }
  const audio=createOceanAudio(render);
  audio.setVolume(preferences.volume);render('paused');
  toggle.addEventListener('click',()=>{
    preferences.enabled=!preferences.enabled;
    saveOceanAudioPreferences(preferences.enabled,preferences.volume);
    audio.setActive(available&&preferences.enabled);
    if(preferences.enabled)audio.unlock();
    render(root.dataset.state as OceanAudioState);
  },{signal});
  slider.addEventListener('input',()=>{
    preferences.volume=Number(slider.value);audio.setVolume(preferences.volume);
    saveOceanAudioPreferences(preferences.enabled,preferences.volume);render(root.dataset.state as OceanAudioState);
  },{signal});
  retry.addEventListener('click',()=>audio.retry(),{signal});
  return {
    unlock(){if(preferences.enabled)audio.unlock();},
    setAvailable(value:boolean,immediate=false){available=value;audio.setActive(value&&preferences.enabled,immediate);},
    dispose(){events.abort();audio.dispose();},
  };
}
