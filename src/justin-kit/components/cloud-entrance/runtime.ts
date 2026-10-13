import { createFogField, createFogTrail } from './fogField';
import { entranceTimePalette, paletteHex } from './timePalette';
export type CloudState = 'loading' | 'ready' | 'revealing' | 'dismissing' | 'error';

function setPaletteStyles(root:HTMLElement, palette:ReturnType<typeof entranceTimePalette>) {
  root.style.setProperty('--cloud-entrance-background', paletteHex(palette.background));
  root.style.setProperty('--cloud-entrance-foreground', paletteHex(palette.foreground));
  root.style.setProperty('--cloud-entrance-progress', paletteHex(palette.progress));
  root.style.setProperty('--cloud-entrance-progress-pending', paletteHex(palette.progressPending));
  root.style.setProperty('--cloud-entrance-focus', paletteHex(palette.focus));
}

export function createCloudEntrance(root: HTMLElement, onEnter: () => void, onRetry: () => void, initialPalette?:ReturnType<typeof entranceTimePalette>) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-cloud-canvas]')!;
  const context = canvas.getContext('2d');
  const status = root.querySelector<HTMLElement>('[data-cloud-status]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-cloud-progress]');
  const error = root.querySelector<HTMLElement>('[data-cloud-error]')!;
  const events = new AbortController();
  const field=createFogField();
  const trail=createFogTrail();
  let palette=initialPalette??entranceTimePalette(new Date());
  setPaletteStyles(root,palette);
  const surface = document.createElement('canvas');
  const title = document.createElement('canvas');
  const underneath = document.createElement('canvas');
  const patch = document.createElement('canvas');
  const clouds=document.createElement('canvas');
  const trailMask=document.createElement('canvas');
  let cloudPixels:ImageData, trailPixels:ImageData;
  let lastReveal=-1, lastTrail=false;
  let state: CloudState = 'loading', reveal = 0, disposed = false, frame = 0;
  let width = 1, height = 1, pixelRatio = 1, progress = 0, previous = 0;
  let pointer: { x: number; y: number } | undefined, down: { x: number; y: number } | undefined;
  let dismissal: Animation | undefined, readyFade: Animation | undefined;
  let readyFadePending = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  root.toggleAttribute('data-suspended', document.hidden);
  function bake() {
    surface.width = title.width = width; surface.height = title.height = height;
    const ctx = surface.getContext('2d')!;
    clouds.width = Math.max(1, Math.min(384, Math.round(288 * width / height)));
    clouds.height = Math.max(1, Math.min(288, Math.round(clouds.width * height / width)));
    cloudPixels = clouds.getContext('2d')!.createImageData(clouds.width, clouds.height);
    field.paint(clouds.width, clouds.height, 0, cloudPixels.data, palette.mist);
    clouds.getContext('2d')!.putImageData(cloudPixels, 0, 0);
    ctx.drawImage(clouds, 0, 0, width, height);
    trail.resize(clouds.width, clouds.height);
    trailMask.width = clouds.width; trailMask.height = clouds.height;
    trailPixels = trailMask.getContext('2d')!.createImageData(clouds.width, clouds.height);
    const fontSize = Math.max(80 * pixelRatio, Math.min(width * .17, 250 * pixelRatio));
    function drawTitle(target: CanvasRenderingContext2D, blur: number, alpha: number) {
      target.save();
      target.font = `600 ${fontSize}px Georgia, serif`; target.letterSpacing = `${fontSize * -.045}px`; target.textAlign = 'center'; target.textBaseline = 'middle';
      // Draw only the soft shadow: Canvas filters are unavailable in Safari.
      target.shadowColor = `rgba(${palette.titleShadow.join(',')},${alpha})`;
      target.shadowBlur = blur * 2; target.shadowOffsetX = width * 2;
      target.fillStyle = '#000';
      target.fillText(root.dataset.title ?? 'Justin', width / 2 - width * 2, height * .5);
      target.restore();
    }
    drawTitle(title.getContext('2d')!, 9 * pixelRatio, .13);
    ctx.drawImage(title, 0, 0);
    underneath.width = patch.width = width; underneath.height = patch.height = height;
    const under = underneath.getContext('2d')!;
    drawTitle(under, 3 * pixelRatio, .3);
    lastReveal = -1;
  }
  const smooth = (value:number) => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function drawClouds(activeTrail: boolean) {
    const cloudProgress = state === 'revealing' && !reduce.matches ? reveal : 0;
    if (cloudProgress !== lastReveal || activeTrail || lastTrail) {
      const blend = smooth(cloudProgress / .35);
      const color = palette.mist.map((channel, index) =>
        channel + (palette.cloud[index] - channel) * blend
      ) as [number, number, number];
      field.paint(clouds.width, clouds.height, cloudProgress, cloudPixels.data, color, activeTrail ? trail : undefined);
      clouds.getContext('2d')!.putImageData(cloudPixels, 0, 0);
    }
    context!.drawImage(clouds, 0, 0, width, height);
    lastReveal = cloudProgress; lastTrail = activeTrail;
  }
  function drawStatus(alpha = 1, blur = 0) {
    const text = status.textContent ?? '';
    if (!text) return;
    const statusRect = status.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
    const style = getComputedStyle(status);
    const x = (statusRect.left - rootRect.left + statusRect.width / 2) * width / rootRect.width;
    const y = (statusRect.top - rootRect.top + statusRect.height / 2) * height / rootRect.height;
    context!.save();
    context!.globalAlpha = alpha;
    const statusFontSize = Number.parseFloat(style.fontSize) * pixelRatio;
    context!.font = `${style.fontWeight} ${statusFontSize}px ${style.fontFamily}`;
    context!.letterSpacing = `${Number.parseFloat(style.letterSpacing) * pixelRatio}px`;
    context!.textAlign = 'center'; context!.textBaseline = 'middle';
    context!.fillStyle = paletteHex(palette.foreground);
    if (blur > 0) {
      // Small Gaussian taps also soften text on browsers without Canvas filter support.
      const weights = [1, 2, 1];
      for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
        context!.globalAlpha = alpha * weights[row] * weights[column] / 16;
        context!.fillText(text, x + (column - 1) * blur, y + (row - 1) * blur);
      }
    } else context!.fillText(text, x, y);
    context!.restore();
  }
  function syncProgressSemantics() {
    if (!progressBar) return;
    const value = Math.round(progress * 100);
    progressBar.setAttribute('aria-valuenow', String(value));
    progressBar.setAttribute('aria-valuetext', `${status.textContent ?? ''}，${value}%`);
  }
  function updatePalette() {
    if(initialPalette||disposed||document.hidden||root.hidden)return;
    const next=entranceTimePalette(new Date());
    if(JSON.stringify(next)===JSON.stringify(palette))return;
    palette=next;setPaletteStyles(root,palette);bake();requestPaint();
  }
  function paint(now = performance.now()) {
    frame = 0;
    if (disposed || !context || document.hidden || root.hidden || root.hasAttribute('data-suspended')) return;
    if (readyFadePending) { readyFadePending = false; readyFade?.play(); }
    const delta = previous ? Math.max(0, now - previous) : 16; previous = now;
    const activeTrail = trail.advance(delta);
    context.clearRect(0, 0, width, height);
    if(state==='revealing'&&!reduce.matches) {
      drawClouds(false);
      // The identical initial field and title dissolve into advected layers.
      context.globalAlpha=1-smooth(reveal/.18);
      context.drawImage(surface,0,0);context.globalAlpha=1;
    } else if (activeTrail) {
      drawClouds(true); context.drawImage(title, 0, 0);
    } else context.drawImage(surface, 0, 0);
    if (activeTrail) {
      for (let i = 0; i < trail.mask.length; i++) trailPixels.data[i * 4 + 3] = Math.round(trail.mask[i] * 255);
      trailMask.getContext('2d')!.putImageData(trailPixels, 0, 0);
      const ctx=patch.getContext('2d')!;ctx.clearRect(0,0,width,height);
      ctx.drawImage(underneath,0,0);ctx.globalCompositeOperation='destination-in';
      ctx.drawImage(trailMask,0,0,width,height);ctx.globalCompositeOperation='source-over';
      context.drawImage(patch,0,0);
    }
    if (state === 'revealing') {
      if (reduce.matches) {
        context.globalCompositeOperation = 'destination-out'; context.globalAlpha = reveal;
        context.fillRect(0, 0, width, height); context.globalAlpha = 1;
      }
      context.globalCompositeOperation = 'source-over';
    }
    const statusAlpha = state === 'revealing' ? (reduce.matches ? 0 : 1 - smooth(reveal / .14)) : 1;
    if (statusAlpha > 0) drawStatus(statusAlpha, state === 'revealing' ? (1 - statusAlpha) * 4 * pixelRatio : 0);
    root.dataset.painted = 'true';
    if (activeTrail) requestPaint(); else previous = 0;
  }
  function requestPaint() { if (!frame && !disposed && !document.hidden && !root.hidden && !root.hasAttribute('data-suspended')) frame = requestAnimationFrame(paint); }
  function resize() {
    const rect = root.getBoundingClientRect(), nextRatio = Math.min(devicePixelRatio, 1.25);
    const nextWidth = Math.max(1, Math.round(rect.width * nextRatio)), nextHeight = Math.max(1, Math.round(rect.height * nextRatio));
    if (cloudPixels && canvas.width === nextWidth && canvas.height === nextHeight && pixelRatio === nextRatio) return;
    pixelRatio = nextRatio; width = nextWidth; height = nextHeight;
    pointer = undefined; trail.clear();
    canvas.width = width; canvas.height = height; bake();
    // ResizeObserver runs after RAF; never leave its cleared canvas until the next frame.
    cancelAnimationFrame(frame); frame = 0; paint();
  }
  const paletteTimer=initialPalette?undefined:window.setInterval(updatePalette,60_000);
  const observer = new ResizeObserver(resize); observer.observe(root); resize();
  function excluded(target: EventTarget | null) { return target instanceof Element && Boolean(target.closest('a,button,input,textarea,select,[contenteditable],[data-cloud-no-enter]')); }
  root.addEventListener('pointermove', event => {
    if (!['loading', 'ready'].includes(state) || reduce.matches || event.pointerType === 'touch' || document.hidden || root.hasAttribute('data-suspended')) return;
    const rect = root.getBoundingClientRect();
    const next = { x: (event.clientX - rect.left) * clouds.width / rect.width, y: (event.clientY - rect.top) * clouds.height / rect.height };
    if (pointer && pointer.x === next.x && pointer.y === next.y) return;
    const radius = Math.max(64, Math.min(120, Math.min(rect.width, rect.height) * .12)) * clouds.width / rect.width;
    trail.stroke(pointer ?? next, next, radius); pointer = next; requestPaint();
  }, { signal: events.signal });
  root.addEventListener('pointerleave', () => { pointer = undefined; }, { signal: events.signal });
  reduce.addEventListener('change', () => { trail.clear(); pointer = undefined; requestPaint(); }, { signal: events.signal });
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
    root.toggleAttribute('data-suspended', document.hidden);
    cancelAnimationFrame(frame); frame = 0; previous = 0; pointer = undefined;
    if (document.hidden) { dismissal?.pause(); if (readyFade?.playState === 'running') readyFade.pause(); }
    else { dismissal?.play(); if (!readyFadePending && readyFade?.playState === 'paused') readyFade.play(); updatePalette(); requestPaint(); }
  }, { signal: events.signal });
  window.addEventListener('pagehide', () => { root.setAttribute('data-suspended', ''); cancelAnimationFrame(frame); frame = 0; previous = 0; pointer = undefined; dismissal?.pause(); if (readyFade?.playState === 'running') readyFade.pause(); }, { signal: events.signal });
  window.addEventListener('pageshow', () => { root.toggleAttribute('data-suspended', document.hidden); if (!document.hidden) { dismissal?.play(); if (!readyFadePending && readyFade?.playState === 'paused') readyFade.play(); } updatePalette(); requestPaint(); }, { signal: events.signal });
  return {
    setPalette(next:ReturnType<typeof entranceTimePalette>) {
      if(disposed||root.hidden||JSON.stringify(next)===JSON.stringify(palette))return;
      palette=next;setPaletteStyles(root,palette);bake();requestPaint();
    },
    setState(value: CloudState, message?: string) {
      const fadeProgress = value === 'ready' && state === 'loading';
      if (value !== 'ready') { readyFade?.cancel(); readyFade = undefined; readyFadePending = false; }
      if (value === 'loading' || value === 'error') {
        dismissal?.cancel(); dismissal = undefined; root.style.removeProperty('opacity');
      }
      root.toggleAttribute('data-dismiss-progress', value === 'dismissing' && (state === 'loading' || root.hasAttribute('data-dismiss-progress')));
      state = value; root.dataset.state = value; root.setAttribute('aria-busy', String(value === 'loading'));
      root.inert = value === 'revealing' || value === 'dismissing';
      root.tabIndex = value === 'ready' ? 0 : -1;
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', value === 'ready' ? `${root.dataset.title}，${root.dataset.readyText}` : value === 'dismissing' ? '工作室已准备' : `${root.dataset.title}，网站准备页`);
      if(value==='ready')root.setAttribute('aria-keyshortcuts','Enter Space');else root.removeAttribute('aria-keyshortcuts');
      if(value!=='revealing'&&value!=='dismissing')status.textContent = message ?? (value === 'ready' ? root.dataset.readyText! : root.dataset.loadingText!);
      if (value === 'ready') { progress = 1; root.style.setProperty('--cloud-progress', '1'); }
      if (fadeProgress && progressBar && !reduce.matches) {
        readyFade = progressBar.animate([
          { opacity: 1, visibility: 'visible' },
          { opacity: 0, visibility: 'visible' },
        ], { duration: 200, easing: 'ease' });
        // Start on the next painted frame after synchronous scene preparation.
        readyFade.pause(); readyFade.currentTime = 0; readyFadePending = true;
      }
      syncProgressSemantics();
      error.hidden = value !== 'error';
      if (value !== 'loading' && value !== 'ready') { trail.clear(); pointer = undefined; down = undefined; }
      if (value === 'revealing' || value === 'dismissing') { lastReveal = -1; }
      else { reveal = 0;lastReveal=-1;clouds.getContext('2d')!.clearRect(0,0,clouds.width,clouds.height); }
      if (value === 'ready' && document.activeElement === document.body) root.focus({ preventScroll: true });
      requestPaint();
    },
    setProgress(value: number) {
      if (disposed || !Number.isFinite(value)) return;
      progress = Math.max(0, Math.min(1, value));
      root.style.setProperty('--cloud-progress', String(progress));
      syncProgressSemantics();
      requestPaint();
    },
    // Called by the scene's active clock, never an independent animation timer.
    setRevealProgress(value: number) { cancelAnimationFrame(frame); frame=0; reveal = value; paint(); },
    dismiss(duration: number) {
      if (disposed || root.hidden) return Promise.resolve();
      this.setState('dismissing');
      if (duration <= 0 || reduce.matches) { root.style.opacity = '0'; return Promise.resolve(); }
      dismissal?.cancel();
      dismissal = root.animate([
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(1.035)' },
      ], { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      return dismissal.finished.then(() => undefined, () => undefined);
    },
    dispose() {
      if (disposed) return; disposed = true; events.abort(); observer.disconnect(); cancelAnimationFrame(frame); window.clearInterval(paletteTimer);
      dismissal?.cancel(); readyFade?.cancel();
      canvas.width = canvas.height = surface.width = surface.height = title.width = title.height = underneath.width = underneath.height = patch.width = patch.height = 0;
      clouds.width=clouds.height=trailMask.width=trailMask.height=0;
      cloudPixels=trailPixels=new ImageData(1,1);field.dispose();trail.dispose();
      root.hidden = true;
    },
  };
}
