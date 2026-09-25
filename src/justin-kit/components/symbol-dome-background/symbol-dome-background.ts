
import { makeDomePoints, type DomePoint } from "./domeModel";
import { drawDomeFrame } from "./domeRenderer";

const SELECTOR = "[data-symbol-dome-background]";
const CANVAS_SELECTOR = "[data-symbol-dome-canvas]";

function hasCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function waitForCanvasSize(element: HTMLElement, canvas: HTMLCanvasElement) {
  if (element.dataset.symbolDomePending === "true") {
    return () => {};
  }

  element.dataset.symbolDomePending = "true";
  let frameId = 0;

  const cleanup = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    observer.disconnect();
    delete element.dataset.symbolDomePending;
  };

  const tryStart = () => {
    frameId = 0;

    if (!element.isConnected) {
      cleanup();
      return;
    }

    if (hasCanvasSize(canvas)) {
      cleanup();
      initSymbolDomeBackground(element);
      return;
    }

    frameId = window.requestAnimationFrame(tryStart);
  };

  const observer = new ResizeObserver(() => {
    if (!frameId) frameId = window.requestAnimationFrame(tryStart);
  });

  observer.observe(canvas);
  frameId = window.requestAnimationFrame(tryStart);
  return cleanup;
}


export function initSymbolDomeBackground(element: HTMLElement) {
  if (element.dataset.symbolDomeBound === "true") {
    return () => {};
  }

  const candidateCanvas = element.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);
  if (!candidateCanvas) {
    return () => {};
  }
  const candidateContext = candidateCanvas.getContext("2d", { alpha: true });
  if (!candidateContext) {
    return () => {};
  }
  const canvas: HTMLCanvasElement = candidateCanvas;
  const ctx: CanvasRenderingContext2D = candidateContext;

  if (!hasCanvasSize(canvas)) {
    return waitForCanvasSize(element, canvas);
  }

  element.dataset.symbolDomeBound = "true";

  let points: DomePoint[] = [];
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rotation = 0;
  let lastFrameAt = 0;
  let pointerX = -9999;
  let pointerY = -9999;
  let hasPointer = false;
  let pointerInside = false;
  let lookX = 0;
  let lookY = 0;
  let frameId = 0;
  let resizeFrame = 0;
  let visibilityObserver: MutationObserver | null = null;
  const visibilityHost = element.parentElement?.closest<HTMLElement>("[aria-hidden]");
  const startupResizeTimers: number[] = [];


  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = rect.width;
    const nextHeight = rect.height;

    if (nextWidth <= 0 || nextHeight <= 0) {
      return;
    }

    const nextCanvasWidth = Math.round(nextWidth * nextDpr);
    const nextCanvasHeight = Math.round(nextHeight * nextDpr);
    const sizeChanged =
      Math.abs(nextWidth - width) > 0.5 ||
      Math.abs(nextHeight - height) > 0.5 ||
      nextDpr !== dpr ||
      canvas.width !== nextCanvasWidth ||
      canvas.height !== nextCanvasHeight;

    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;

    if (sizeChanged) {
      canvas.width = nextCanvasWidth;
      canvas.height = nextCanvasHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (sizeChanged || points.length === 0) {
      points = makeDomePoints(height);
    }
  }

  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
    });
  }

  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    if (
      Math.abs(rect.width - width) > 0.5 ||
      Math.abs(rect.height - height) > 0.5 ||
      canvas.width === 0 ||
      canvas.height === 0 ||
      points.length === 0
    ) {
      resize();
    }
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    hasPointer = true;
    pointerInside = pointerX >= 0 && pointerX <= rect.width && pointerY >= 0 && pointerY <= rect.height;
  }

  function clearPointer() {
    hasPointer = false;
    pointerInside = false;
    pointerX = -9999;
    pointerY = -9999;
  }

  function shouldAnimate() {
    return document.visibilityState === "visible" && visibilityHost?.getAttribute("aria-hidden") !== "true";
  }

  function stopFrameLoop() {
    if (!frameId) return;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function startFrameLoop() {
    if (frameId || !element.isConnected || !shouldAnimate()) return;
    lastFrameAt = 0;
    scheduleResize();
    frameId = window.requestAnimationFrame(draw);
  }

  function syncFrameLoop() {
    if (shouldAnimate()) {
      startFrameLoop();
      return;
    }
    stopFrameLoop();
    lastFrameAt = 0;
  }

  function draw(now: number) {
    frameId = 0;

    if (!element.isConnected) {
      cleanup();
      return;
    }

    if (!shouldAnimate()) {
      lastFrameAt = 0;
      return;
    }

    syncCanvasSize();

    if (width <= 0 || height <= 0) {
      startFrameLoop();
      return;
    }

    const elapsed = lastFrameAt ? Math.min(0.05, (now - lastFrameAt) / 1000) : 0.016;
    lastFrameAt = now;
    ctx.clearRect(0, 0, width, height);

    ({ rotation, lookX, lookY } = drawDomeFrame(ctx, points, {
      width, height, rotation, lookX, lookY,
      pointerX, pointerY, hasPointer, pointerInside,
    }, now, elapsed, reducedMotionQuery.matches));

    frameId = window.requestAnimationFrame(draw);
  }

  const handleWindowMouseOut = (event: MouseEvent) => {
    if (!event.relatedTarget) {
      clearPointer();
    }
  };

  const handleVisibilityChange = () => {
    syncFrameLoop();
  };

  const resizeObserver = new ResizeObserver(resize);
  if (visibilityHost) {
    visibilityObserver = new MutationObserver(syncFrameLoop);
    visibilityObserver.observe(visibilityHost, { attributes: true, attributeFilter: ["aria-hidden"] });
  }
  resizeObserver.observe(canvas);
  document.addEventListener("pointermove", updatePointer, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", scheduleResize);
  window.addEventListener("blur", clearPointer);
  window.addEventListener("mouseout", handleWindowMouseOut);
  window.addEventListener("resize", scheduleResize);
  reducedMotionQuery.addEventListener("change", resize);
  resize();
  [0, 120, 480, 1000, 1600].forEach((delay) => {
    startupResizeTimers.push(window.setTimeout(scheduleResize, delay));
  });
  startFrameLoop();

  function cleanup() {
    document.removeEventListener("pointermove", updatePointer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", scheduleResize);
    window.removeEventListener("blur", clearPointer);
    window.removeEventListener("mouseout", handleWindowMouseOut);
    window.removeEventListener("resize", scheduleResize);
    reducedMotionQuery.removeEventListener("change", resize);
    startupResizeTimers.forEach((timer) => window.clearTimeout(timer));
    resizeObserver.disconnect();
    visibilityObserver?.disconnect();

    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }

    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    delete element.dataset.symbolDomeBound;
    delete element.dataset.symbolDomePending;
  }

  return cleanup;
}

export function initSymbolDomeBackgrounds() {
  document
    .querySelectorAll<HTMLElement>(SELECTOR)
    .forEach((element) => initSymbolDomeBackground(element));
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSymbolDomeBackgrounds, { once: true });
  } else {
    initSymbolDomeBackgrounds();
  }
}
