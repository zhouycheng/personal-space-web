import { createFogField } from './fogField';
import { entranceTimePalette, paletteHex, paletteRgb } from './timePalette';
export type CloudState = 'loading' | 'ready' | 'revealing' | 'dismissing' | 'error';

/** Precomputed, deterministic opaque preparation surface. */
function mistTexture(sample:(x:number,y:number)=>number, palette:ReturnType<typeof entranceTimePalette>) {
  const texture = document.createElement('canvas');
  texture.width = 480; texture.height = 300;
  paintMist(texture, sample, palette);
  return texture;
}

function paintMist(texture:HTMLCanvasElement, sample:(x:number,y:number)=>number, palette:ReturnType<typeof entranceTimePalette>) {
  const context = texture.getContext('2d')!;
  context.fillStyle = paletteRgb(palette.mist); context.fillRect(0, 0, texture.width, texture.height);
  let seed = 137;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const noise=context.createImageData(texture.width,texture.height);
  for(let y=0;y<texture.height;y++)for(let x=0;x<texture.width;x++) {
    const shade=(sample(x/texture.width,y/texture.height)-.5)*38,index=(y*texture.width+x)*4;
    noise.data[index]=palette.mist[0]+shade;noise.data[index+1]=palette.mist[1]+shade;noise.data[index+2]=palette.mist[2]+shade;noise.data[index+3]=255;
  }
  context.putImageData(noise,0,0);
  for (let i = 0; i < 180; i++) {
    const x = random() * texture.width * 1.25 - texture.width * .125, y = random() * texture.height * 1.4 - texture.height * .2, radius = 18 + random() * 65;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const light = i % 3 !== 0;
    const tone=light?palette.mistLight:palette.mistShadow,opacity=light?.15:.09;
    gradient.addColorStop(0, `rgba(${tone.join(',')},${opacity})`);
    gradient.addColorStop(1, `rgba(${tone.join(',')},0)`);
    context.fillStyle = gradient; context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function setPaletteStyles(root:HTMLElement, palette:ReturnType<typeof entranceTimePalette>) {
  root.style.setProperty('--cloud-entrance-background', paletteHex(palette.background));
  root.style.setProperty('--cloud-entrance-foreground', paletteHex(palette.foreground));
  root.style.setProperty('--cloud-entrance-progress', paletteHex(palette.progress));
  root.style.setProperty('--cloud-entrance-progress-pending', paletteHex(palette.progressPending));
  root.style.setProperty('--cloud-entrance-focus', paletteHex(palette.focus));
}

export function createCloudEntrance(root: HTMLElement, onEnter: () => void, onRetry: () => void) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-cloud-canvas]')!;
  const context = canvas.getContext('2d');
  const status = root.querySelector<HTMLElement>('[data-cloud-status]')!;
  const error = root.querySelector<HTMLElement>('[data-cloud-error]')!;
  const events = new AbortController();
  const field=createFogField();
  let palette=entranceTimePalette(new Date());
  setPaletteStyles(root,palette);
  const texture = mistTexture(field.sample,palette);
  const surface = document.createElement('canvas');
  const underneath = document.createElement('canvas');
  const patch = document.createElement('canvas');
  const clouds=document.createElement('canvas'),trail=document.createElement('canvas');
  let cloudPixels:ImageData;
  let lastReveal=-1;
  let state: CloudState = 'loading', reveal = 0, disposed = false, frame = 0;
  let width = 1, height = 1, hover = 0, hoverTarget = 0, previous = 0;
  let pointer = { x: -1, y: -1 }, down: { x: number; y: number } | undefined;
  let dismissal: Animation | undefined;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function bake() {
    surface.width = width; surface.height = height;
    const ctx = surface.getContext('2d')!;
    ctx.drawImage(texture, 0, 0, width, height);
    const fontSize = Math.min(width * .22, height * .29);
    ctx.font = `600 ${fontSize}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // A soft shadow under a thin veil, with no bright edge or embossed outline.
    ctx.filter = `blur(${Math.max(4, fontSize * .025)}px)`;
    ctx.fillStyle = `rgba(${palette.titleShadow.join(',')},.18)`; ctx.fillText(root.dataset.title ?? 'Justin', width / 2, height * .5);
    underneath.width = patch.width = width; underneath.height = patch.height = height;
    const under = underneath.getContext('2d')!;
    under.drawImage(surface, 0, 0);
    under.filter = `blur(${Math.max(2,fontSize * .012)}px)`; under.font=ctx.font;under.textAlign='center';under.textBaseline='middle';
    under.fillStyle=`rgba(${palette.titleShadow.join(',')},.055)`;under.fillText(root.dataset.title ?? 'Justin',width/2,height*.5);
    ctx.filter = 'none'; ctx.globalAlpha = .38;
    ctx.drawImage(texture, -width * .08, height * .03, width * 1.16, height * 1.08);
    ctx.globalAlpha = 1;
    clouds.width=Math.min(320,Math.round(256*width/height));clouds.height=Math.min(256,Math.round(clouds.width*height/width));
    clouds.width=Math.max(1,clouds.width);clouds.height=Math.max(1,clouds.height);
    trail.width=clouds.width;trail.height=clouds.height;
    cloudPixels=clouds.getContext('2d')!.createImageData(clouds.width,clouds.height);lastReveal=-1;
  }
  const smooth = (value:number) => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function drawClouds() {
    const ctx=clouds.getContext('2d')!;
    const trailCtx=trail.getContext('2d')!;
    if(reveal!==lastReveal) {
      trailCtx.clearRect(0,0,trail.width,trail.height);trailCtx.drawImage(clouds,0,0);
      field.paint(clouds.width,clouds.height,reveal,cloudPixels.data,palette.cloud);ctx.putImageData(cloudPixels,0,0);
    }
    context!.save();
    const softness=(1.5-smooth((reveal-.2)/.5)*.8)*Math.max(width/clouds.width,height/clouds.height);
    context!.filter=`blur(${softness}px)`;
    context!.globalAlpha=(lastReveal>=0&&reveal>lastReveal) ? .12 : 0;
    context!.drawImage(trail,0,0,width,height);
    context!.globalAlpha=1;context!.drawImage(clouds,0,0,width,height);
    context!.restore();lastReveal=reveal;
  }
  function updatePalette() {
    const next=entranceTimePalette(new Date());
    if(JSON.stringify(next)===JSON.stringify(palette))return;
    palette=next;setPaletteStyles(root,palette);paintMist(texture,field.sample,palette);bake();requestPaint();
  }
  function paint(now = performance.now()) {
    frame = 0;
    if (disposed || !context || document.hidden || root.hidden) return;
    const delta = previous ? Math.min(50, now - previous) : 16; previous = now;
    hover += (hoverTarget - hover) * (1 - Math.exp(-delta / 160));
    if (Math.abs(hoverTarget - hover) < .005) hover = hoverTarget;
    context.clearRect(0, 0, width, height);
    if(state==='revealing'&&!reduce.matches) {
      drawClouds();
      // The loading veil dissolves over the cloud field, before that field
      // parts to reveal the scene. All cloud opacity belongs to one field.
      context.globalAlpha=1-smooth(reveal/.18);
      context.drawImage(surface,0,0);context.globalAlpha=1;
    } else context.drawImage(surface, 0, 0);
    if (hover > 0 && state !== 'revealing') {
      // Scatter the upper veil locally; the underlying surface stays opaque.
      const radius = Math.min(width, height) * .18;
      const ctx=patch.getContext('2d')!;ctx.clearRect(0,0,width,height);
      ctx.drawImage(underneath,0,0);ctx.globalCompositeOperation='destination-in';
      const gradient = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${hover * .85})`); gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
      context.drawImage(patch,0,0);
    }
    if (state === 'revealing') {
      if (reduce.matches) {
        context.globalCompositeOperation = 'destination-out'; context.globalAlpha = reveal;
        context.fillRect(0, 0, width, height); context.globalAlpha = 1;
      }
      context.globalCompositeOperation = 'source-over';
    }
    root.dataset.painted = 'true';
    if (hover !== hoverTarget) requestPaint();
  }
  function requestPaint() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(paint); }
  function resize() {
    const rect = root.getBoundingClientRect(), scale = Math.min(devicePixelRatio, 1.25);
    width = Math.max(1, Math.round(rect.width * scale)); height = Math.max(1, Math.round(rect.height * scale));
    canvas.width = width; canvas.height = height; bake(); requestPaint();
  }
  const paletteTimer=window.setInterval(updatePalette,60_000);
  const observer = new ResizeObserver(resize); observer.observe(root); resize();
  function excluded(target: EventTarget | null) { return target instanceof Element && Boolean(target.closest('a,button,input,textarea,select,[contenteditable],[data-cloud-no-enter]')); }
  root.addEventListener('pointermove', event => {
    if (state === 'revealing' || reduce.matches || event.pointerType === 'touch') return;
    const rect = root.getBoundingClientRect(); pointer = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
    hoverTarget = 1; requestPaint();
  }, { signal: events.signal });
  root.addEventListener('pointerleave', () => { hoverTarget = 0; requestPaint(); }, { signal: events.signal });
  root.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; }, { signal: events.signal });
  root.addEventListener('click', event => {
    if (state !== 'ready' || excluded(event.target) || window.getSelection()?.toString() || (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)) return;
    event.stopPropagation(); onEnter();
  }, { signal: events.signal });
  root.addEventListener('keydown', event => {
    if (state !== 'ready' || excluded(event.target) || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); onEnter();
  }, { signal: events.signal });
  root.querySelector('[data-cloud-retry]')!.addEventListener('click', onRetry, { signal: events.signal });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (document.hidden) dismissal?.pause();
    else { dismissal?.play(); updatePalette(); requestPaint(); }
  }, { signal: events.signal });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; previous = 0; if (document.hidden) dismissal?.pause(); }, { signal: events.signal });
  window.addEventListener('pageshow', () => { updatePalette(); requestPaint(); }, { signal: events.signal });
  return {
    setState(value: CloudState, message?: string) {
      state = value; root.dataset.state = value; root.setAttribute('aria-busy', String(value === 'loading'));
      root.inert = value === 'revealing' || value === 'dismissing';
      root.tabIndex = value === 'ready' ? 0 : -1;
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', value === 'ready' ? `${root.dataset.title}，${root.dataset.readyText}` : value === 'dismissing' ? '工作室已准备' : '网站准备页');
      if(value==='ready')root.setAttribute('aria-keyshortcuts','Enter Space');else root.removeAttribute('aria-keyshortcuts');
      if(value!=='revealing'&&value!=='dismissing')status.textContent = message ?? (value === 'ready' ? root.dataset.readyText! : root.dataset.loadingText!);
      error.hidden = value !== 'error';
      if (value === 'revealing' || value === 'dismissing') { hover = hoverTarget = 0; down = undefined; }
      else { reveal = 0;lastReveal=-1;clouds.getContext('2d')!.clearRect(0,0,clouds.width,clouds.height); }
      if (value === 'ready' && document.activeElement === document.body) root.focus({ preventScroll: true });
      requestPaint();
    },
    setProgress(value: number) { root.style.setProperty('--cloud-progress', `${Math.max(0, Math.min(1, value)) * 100}%`); },
    // Called by the scene's active clock, never an independent animation timer.
    setRevealProgress(value: number) { cancelAnimationFrame(frame); frame=0; reveal = value; paint(); },
    dismiss(duration: number) {
      if (disposed || root.hidden) return Promise.resolve();
      this.setState('dismissing');
      if (duration <= 0 || reduce.matches) { root.style.opacity = '0'; return Promise.resolve(); }
      dismissal?.cancel();
      dismissal = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-out', fill: 'forwards' });
      return dismissal.finished.then(() => undefined, () => undefined);
    },
    dispose() {
      if (disposed) return; disposed = true; events.abort(); observer.disconnect(); cancelAnimationFrame(frame); window.clearInterval(paletteTimer);
      dismissal?.cancel();
      canvas.width = canvas.height = surface.width = surface.height = underneath.width = underneath.height = patch.width = patch.height = texture.width = texture.height = 0;
      clouds.width=clouds.height=trail.width=trail.height=0;
      cloudPixels=new ImageData(1,1);field.dispose();
      root.hidden = true;
    },
  };
}
