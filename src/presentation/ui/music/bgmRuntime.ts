import { readMusicPreferences, saveMusicPreferences } from '../../../infrastructure/client/musicPreferences';

type Track = { id: string; name: string; artist?: string; src: string };
export function createBgmPlayer(shell: HTMLElement, playbackChanged: (playing: boolean) => void) {
  const events = new AbortController(), { signal } = events;
  const root=shell.querySelector<HTMLElement>('[data-bgm]')!;
  const audio = root.querySelector('audio')!;
  const statuses = [...shell.querySelectorAll<HTMLElement>('[data-bgm-status]')];
  const titles = [...shell.querySelectorAll<HTMLElement>('[data-bgm-name]')];
  const profile = shell.querySelector<HTMLElement>('[data-bgm-desktop]')!;
  const slider = shell.querySelector<HTMLInputElement>('.bgm-settings input')!;
  const playButtons = [...shell.querySelectorAll<HTMLButtonElement>('[data-bgm-play]')];
  const raw: unknown = JSON.parse(root.dataset.tracks ?? '[]');
  const tracks: Track[] = Array.isArray(raw) ? raw.filter((t): t is Track => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.src === 'string' && /^\/(?!\/)/.test(t.src) && (t.artist === undefined || typeof t.artist === 'string')) : [];
  profile.querySelector<HTMLElement>('.bgm-menu')!.hidden = !tracks.length;
  const preferences = readMusicPreferences();
  let index = Math.max(0, tracks.findIndex(t => t.id === preferences.id));
  let playing = false, failed = false, pending = false, version = 0;
  audio.volume = .5;
  const deviceVolume = Math.abs(audio.volume - .5) > .01;
  audio.volume = preferences.volume;
  slider.value = String(preferences.volume);
  function save() { saveMusicPreferences(tracks[index]?.id, Number(slider.value)); }
  function render() {
    root.dataset.playing = String(playing);
    profile.dataset.playing=String(playing);profile.dataset.active=String(playing||pending);
    profile.dataset.failed=String(failed);
    shell.querySelector<HTMLElement>('.bgm-settings')!.dataset.playing=String(playing);
    for (const status of statuses) status.textContent = !tracks.length?'尚未添加曲目':failed ? '加载失败 · 点击播放重试' : pending ? '正在加载…' : '';
    const label = failed ? '重试播放' : playing || pending ? '暂停音乐' : '播放音乐';
    for(const button of playButtons) {
      button.disabled=!tracks.length;button.setAttribute('aria-label',label);button.title=label;
      button.setAttribute('aria-pressed',String(playing));
      if(button.closest('.bgm-menu'))button.title=tracks[index]?`${tracks[index].name} · ${label}`:'尚未添加音乐';
      if(!button.querySelector('svg'))button.textContent=failed?'重试':playing||pending?'暂停':'播放';
    }
    root.title=tracks[index]?.name??'暂无音乐';
    slider.disabled = !tracks.length;
    slider.setAttribute('aria-valuetext',`${Math.round(Number(slider.value) * 100)}%`);
    shell.querySelector<HTMLOutputElement>('[data-bgm-volume]')!.value=`${Math.round(Number(slider.value)*100)}%`;
    for (const title of titles) { title.textContent=tracks[index]?.name ?? '暂无音乐';title.title=title.textContent; }
    shell.querySelector<HTMLElement>('[data-bgm-artist]')!.textContent = tracks[index]?.artist ?? '';
  }
  function setPlaying(value: boolean) {
    if (playing !== value) { playing = value; playbackChanged(value); }
    render();
  }
  async function play() {
    if (!tracks.length) return;
    const token = ++version;
    if (!audio.getAttribute('src') || failed) { audio.src = tracks[index].src; audio.load(); }
    failed = false; pending = true; render();
    try { await audio.play(); }
    catch { if (token === version && !signal.aborted) { pending = false; failed = true; setPlaying(false); } }
  }
  function pause() { ++version; pending = false; audio.pause(); setPlaying(false); }
  function select(next: number) {
    if (!tracks.length) return;
    pause(); index = (next + tracks.length) % tracks.length;
    failed = false; audio.src = tracks[index].src; save(); void play();
  }
  for (const [name, direction] of [['prev', -1], ['next', 1]] as const) {
    for (const button of shell.querySelectorAll<HTMLButtonElement>(`[data-bgm-${name}]`)) {
      button.disabled = tracks.length < 2;
      if (button.closest('.bgm-menu')) button.hidden = tracks.length < 2;
      button.addEventListener('click', () => select(index + direction), { signal });
    }
  }
  playButtons.forEach(button=>button.addEventListener('click', () => { if (playing || pending) pause(); else void play(); }, { signal }));
  audio.addEventListener('playing', () => { if (!audio.paused) { pending = false; failed = false; setPlaying(true); } }, { signal });
  audio.addEventListener('waiting', () => { if (!audio.paused) { pending = true; setPlaying(false); } }, { signal });
  audio.addEventListener('pause', () => { pending = false; setPlaying(false); }, { signal });
  audio.addEventListener('error', () => { pending = false; failed = true; setPlaying(false); }, { signal });
  audio.addEventListener('ended', () => select(index + 1), { signal });
  slider.addEventListener('input', () => { audio.volume = Number(slider.value); save(); render(); }, { signal });
  shell.querySelector<HTMLElement>('.bgm-settings-volume')!.hidden = deviceVolume;
  shell.querySelector<HTMLElement>('[data-bgm-device]')!.hidden = !deviceVolume;
  render();
  return { get playing() { return playing; }, dispose() { pause(); events.abort(); audio.removeAttribute('src'); audio.load(); } };
}
