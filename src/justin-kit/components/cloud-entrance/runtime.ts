import { createFogField } from './fogField';
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
  const error = root.querySelector<HTMLElement>('[data-cloud-error]')!;
  const events = new AbortController();
  const field=createFogField();
  let palette=initialPalette??entranceTimePalette(new Date());
  setPaletteStyles(root,palette);
  const surface = document.createElement('canvas');
  const underneath = document.createElement('canvas');
  const patch = document.createElement('canvas');
  const clouds=document.createElement('canvas');
  let cloudPixels:ImageData;
  let lastReveal=-1;
  let state: CloudState = 'loading', reveal = 0, disposed = false, frame = 0;
  let width = 1, height = 1, pixelRatio = 1, progress = 0, hover = 0, hoverTarget = 0, previous = 0;
  let pointer = { x: -1, y: -1 }, down: { x: number; y: number } | undefined;
  let dismissal: Animation | undefined;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  root.toggleAttribute('data-suspended', document.hidden);
  function bake() {
    surface.width = width; surface.height = height;
    const ctx = surface.getContext('2d')!;
    clouds.width = Math.max(1, Math.min(384, Math.round(288 * width / height)));
    clouds.height = Math.max(1, Math.min(288, Math.round(clouds.width * height / width)));
    cloudPixels = clouds.getContext('2d')!.createImageData(clouds.width, clouds.height);
    field.paint(clouds.width, clouds.height, 0, cloudPixels.data, palette.mist);
    clouds.getContext('2d')!.putImageData(cloudPixels, 0, 0);
    ctx.drawImage(clouds, 0, 0, width, height);
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
    drawTitle(ctx, 9 * pixelRatio, .13);
    underneath.width = patch.width = width; underneath.height = patch.height = height;
    const under = underneath.getContext('2d')!;
    under.drawImage(surface, 0, 0);
    drawTitle(under, Math.max(2,fontSize * .012), .055);
    lastReveal = -1;
  }
  const smooth = (value:number) => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function drawClouds() {
    if (reveal !== lastReveal) {
      const blend = smooth(reveal / .35);
      const color = palette.mist.map((channel, index) =>
        channel + (palette.cloud[index] - channel) * blend
      ) as [number, number, number];
      field.paint(clouds.width, clouds.height, reveal, cloudPixels.data, color);
      clouds.getContext('2d')!.putImageData(cloudPixels, 0, 0);
    }
    context!.drawImage(clouds, 0, 0, width, height);
    lastReveal = reveal;
  }
  function drawStatus(alpha = 1, blur = 0) {
    const text = status.textContent ?? '';
    if (!text) return;
    const statusRect = status.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
    const style = getComputedStyle(status);
    const x = (statusRect.left - rootRect.left + statusRect.width / 2) * pixelRatio;
    const y = (statusRect.top - rootRect.top + statusRect.height / 2) * pixelRatio;
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
    const progressBar = root.querySelector<HTMLElement>('[data-cloud-progress]');
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
    if (disposed || !context || document.hidden || root.hidden) return;
    const delta = previous ? Math.min(50, now - previous) : 16; previous = now;
    hover += (hoverTarget - hover) * (1 - Math.exp(-delta / 160));
    if (Math.abs(hoverTarget - hover) < .005) hover = hoverTarget;
    context.clearRect(0, 0, width, height);
    if(state==='revealing'&&!reduce.matches) {
      drawClouds();
      // The identical initial field and title dissolve into advected layers.
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
    const statusAlpha = state === 'revealing' ? (reduce.matches ? 0 : 1 - smooth(reveal / .14)) : 1;
    if (statusAlpha > 0) drawStatus(statusAlpha, state === 'revealing' ? (1 - statusAlpha) * 4 * pixelRatio : 0);
    root.dataset.painted = 'true';
    if (hover !== hoverTarget) requestPaint();
  }
  function requestPaint() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(paint); }
  function resize() {
    const rect = root.getBoundingClientRect(), nextRatio = Math.min(devicePixelRatio, 1.25);
    const nextWidth = Math.max(1, Math.round(rect.width * nextRatio)), nextHeight = Math.max(1, Math.round(rect.height * nextRatio));
    if (cloudPixels && canvas.width === nextWidth && canvas.height === nextHeight && pixelRatio === nextRatio) return;
    pixelRatio = nextRatio; width = nextWidth; height = nextHeight;
    canvas.width = width; canvas.height = height; bake();
    // ResizeObserver runs after RAF; never leave its cleared canvas until the next frame.
    cancelAnimationFrame(frame); frame = 0; paint();
  }
  const paletteTimer=initialPalette?undefined:window.setInterval(updatePalette,60_000);
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
    root.toggleAttribute('data-suspended', document.hidden);
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (document.hidden) dismissal?.pause();
    else { dismissal?.play(); updatePalette(); requestPaint(); }
  }, { signal: events.signal });
  window.addEventListener('pagehide', () => { root.setAttribute('data-suspended', ''); cancelAnimationFrame(frame); frame = 0; previous = 0; dismissal?.pause(); }, { signal: events.signal });
  window.addEventListener('pageshow', () => { root.toggleAttribute('data-suspended', document.hidden); if (!document.hidden) dismissal?.play(); updatePalette(); requestPaint(); }, { signal: events.signal });
  return {
    setPalette(next:ReturnType<typeof entranceTimePalette>) {
      if(disposed||root.hidden||JSON.stringify(next)===JSON.stringify(palette))return;
      palette=next;setPaletteStyles(root,palette);bake();requestPaint();
    },
    setState(value: CloudState, message?: string) {
      state = value; root.dataset.state = value; root.setAttribute('aria-busy', String(value === 'loading'));
      root.inert = value === 'revealing' || value === 'dismissing';
      root.tabIndex = value === 'ready' ? 0 : -1;
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', value === 'ready' ? `${root.dataset.title}，${root.dataset.readyText}` : value === 'dismissing' ? '工作室已准备' : `${root.dataset.title}，网站准备页`);
      if(value==='ready')root.setAttribute('aria-keyshortcuts','Enter Space');else root.removeAttribute('aria-keyshortcuts');
      if(value!=='revealing'&&value!=='dismissing')status.textContent = message ?? (value === 'ready' ? root.dataset.readyText! : root.dataset.loadingText!);
      if (value === 'ready') { progress = 1; root.style.setProperty('--cloud-progress', '1'); }
      syncProgressSemantics();
      error.hidden = value !== 'error';
      if (value === 'revealing' || value === 'dismissing') { hover = hoverTarget = 0; down = undefined; }
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
      dismissal = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-out', fill: 'forwards' });
      return dismissal.finished.then(() => undefined, () => undefined);
    },
    dispose() {
      if (disposed) return; disposed = true; events.abort(); observer.disconnect(); cancelAnimationFrame(frame); window.clearInterval(paletteTimer);
      dismissal?.cancel();
      canvas.width = canvas.height = surface.width = surface.height = underneath.width = underneath.height = patch.width = patch.height = 0;
      clouds.width=clouds.height=0;
      cloudPixels=new ImageData(1,1);field.dispose();
      root.hidden = true;
    },
  };
}
