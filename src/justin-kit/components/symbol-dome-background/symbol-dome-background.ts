import { makeDomePoints, type DomePoint } from './domeModel';
import { drawDomeFrame } from './domeRenderer';
import { observeElementActivity } from '../../runtime/elementActivity';
import { createDomInstances } from '../../runtime/domInstances';

const mounted = new WeakMap<HTMLElement, () => void>();

export function initSymbolDomeBackground(element: HTMLElement) {
  const existing = mounted.get(element);
  if (existing) return existing;
  const candidateCanvas = element.querySelector<HTMLCanvasElement>('[data-symbol-dome-canvas]');
  const candidateContext = candidateCanvas?.getContext('2d', { alpha: true });
  if (!candidateCanvas || !candidateContext) return () => {};
  const canvas: HTMLCanvasElement = candidateCanvas;
  const ctx: CanvasRenderingContext2D = candidateContext;

  element.dataset.symbolDomeBound = 'true';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const options = { signal: events.signal };
  let points: DomePoint[] = [];
  let bounds: DOMRect | null = null;
  let width = 0, height = 0, dpr = 1;
  let rotation = 0, lookX = 0, lookY = 0;
  let pointerX = -9999, pointerY = -9999;
  let hasPointer = false, pointerInside = false;
  let frame = 0, measureFrame = 0, lastFrameAt = 0;
  let available = false, disposed = false;

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrameAt = 0;
  }
  function requestDraw() {
    if (frame || !available || disposed || width <= 0 || height <= 0) return;
    frame = requestAnimationFrame(draw);
  }
  function measure() {
    measureFrame = 0;
    if (disposed || !available) return;
    bounds = canvas.getBoundingClientRect();
    const nextDpr = Math.min(devicePixelRatio || 1, 2);
    const changed = Math.abs(bounds.width - width) > .5 || Math.abs(bounds.height - height) > .5 || nextDpr !== dpr;
    width = bounds.width;
    height = bounds.height;
    dpr = nextDpr;
    if (width <= 0 || height <= 0) {
      // ResizeObserver will wake this instance when its host acquires a size.
      stopFrame();
      return;
    }
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (changed || canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = makeDomePoints(height);
    } else if (!points.length) points = makeDomePoints(height);
    requestDraw();
  }
  function invalidateLayout() {
    bounds = null;
    if (!available || disposed || measureFrame) return;
    measureFrame = requestAnimationFrame(measure);
  }
  function updatePointer(event: PointerEvent) {
    if (!available || width <= 0 || height <= 0) return;
    bounds ??= canvas.getBoundingClientRect();
    pointerX = event.clientX - bounds.left;
    pointerY = event.clientY - bounds.top;
    hasPointer = true;
    pointerInside = pointerX >= 0 && pointerX <= width && pointerY >= 0 && pointerY <= height;
    requestDraw();
  }
  function clearPointer() {
    hasPointer = false;
    pointerInside = false;
    pointerX = pointerY = -9999;
    requestDraw();
  }
  function draw(now: number) {
    frame = 0;
    if (!available || disposed || width <= 0 || height <= 0) return;
    const elapsed = lastFrameAt ? Math.min(.05, (now - lastFrameAt) / 1000) : .016;
    lastFrameAt = now;
    ctx.clearRect(0, 0, width, height);
    const next = drawDomeFrame(ctx, points, {
      width, height, rotation, lookX, lookY, pointerX, pointerY, hasPointer, pointerInside,
    }, now, elapsed, reducedMotion.matches);
    ({ rotation, lookX, lookY } = next);
    if (!reducedMotion.matches || next.settling) requestDraw();
    else lastFrameAt = 0;
  }

  const resizeObserver = new ResizeObserver(invalidateLayout);
  resizeObserver.observe(canvas);
  const stopActivity = observeElementActivity(element, next => {
    available = next;
    if (next) invalidateLayout();
    else {
      stopFrame();
      cancelAnimationFrame(measureFrame);
      measureFrame = 0;
      bounds = null;
      clearPointer();
    }
  });
  document.addEventListener('pointermove', updatePointer, { ...options, passive: true });
  window.addEventListener('resize', invalidateLayout, options);
  window.addEventListener('scroll', invalidateLayout, { ...options, capture: true, passive: true });
  window.addEventListener('pageshow', invalidateLayout, options);
  window.addEventListener('blur', clearPointer, options);
  window.addEventListener('mouseout', event => { if (!event.relatedTarget) clearPointer(); }, options);
  reducedMotion.addEventListener('change', () => { stopFrame(); requestDraw(); }, options);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopActivity();
    stopFrame();
    cancelAnimationFrame(measureFrame);
    resizeObserver.disconnect();
    events.abort();
    points = [];
    delete element.dataset.symbolDomeBound;
    mounted.delete(element);
  }
  mounted.set(element, dispose);
  return dispose;
}

const instances = createDomInstances('[data-symbol-dome-background]', initSymbolDomeBackground);
export const initSymbolDomeBackgrounds = () => instances.init();
if (typeof document !== 'undefined') initSymbolDomeBackgrounds();
