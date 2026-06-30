type Rgb = {
  r: number;
  g: number;
  b: number;
};

type LandMass = {
  u: number;
  v: number;
  rx: number;
  ry: number;
  w: number;
};

type DomePoint = {
  row: number;
  v: number;
  xNorm: number;
  t: number;
  jitterX: number;
  jitterY: number;
  base: number;
  glyphPick: number;
  wave: number;
};

const SELECTOR = "[data-symbol-dome-background]";
const CANVAS_SELECTOR = "[data-symbol-dome-canvas]";

const STAR: Rgb = { r: 255, g: 230, b: 106 };
const LAND: Rgb = { r: 255, g: 242, b: 142 };
const OCEAN: Rgb = { r: 188, g: 185, b: 150 };

const LAND_MASSES: LandMass[] = [
  { u: 0.14, v: 0.36, rx: 0.054, ry: 0.074, w: 1.08 },
  { u: 0.36, v: 0.62, rx: 0.072, ry: 0.09, w: 1.12 },
  { u: 0.64, v: 0.31, rx: 0.058, ry: 0.072, w: 1.04 },
  { u: 0.86, v: 0.72, rx: 0.066, ry: 0.088, w: 1.1 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrap01(value: number) {
  return ((value % 1) + 1) % 1;
}

function circularDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function makeSeededRandom(initialSeed: number) {
  let seed = initialSeed;

  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function noise(u: number, v: number) {
  const a = Math.sin((u * 31.7 + v * 19.3) * Math.PI * 2);
  const b = Math.sin((u * 9.2 - v * 43.1) * Math.PI * 2);
  const c = Math.sin((u * 61.4 + v * 7.7) * Math.PI * 2);
  return (a * 0.5 + b * 0.32 + c * 0.18 + 1) * 0.5;
}

function landValue(u: number, v: number) {
  let value = 0;

  LAND_MASSES.forEach((land) => {
    const dx = circularDistance(u, land.u) / land.rx;
    const dy = (v - land.v) / land.ry;
    const d = dx * dx + dy * dy;
    value += Math.max(0, 1 - d) * land.w;
  });

  return value + (noise(u, v) - 0.5) * 0.22;
}

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

function mixRgb(from: Rgb, to: Rgb, amount: number) {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  };
}

export function initSymbolDomeBackground(element: HTMLElement) {
  if (element.dataset.symbolDomeBound === "true") {
    return () => {};
  }

  const canvas = element.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !ctx) {
    return () => {};
  }

  if (!hasCanvasSize(canvas)) {
    return waitForCanvasSize(element, canvas);
  }

  element.dataset.symbolDomeBound = "true";

  const points: DomePoint[] = [];
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
  let projectionObserver: MutationObserver | null = null;
  const startupResizeTimers: number[] = [];

  function makePoints() {
    points.length = 0;
    const random = makeSeededRandom(32731);
    const rows = Math.round(clamp(height / 12.2, 40, 62));

    for (let row = 0; row < rows; row += 1) {
      const v = (row + 0.5) / rows;
      const domeWidth = Math.sqrt(Math.max(0, 1 - (1 - v) * (1 - v)));
      const topEase = clamp((v - 0.03) / 0.28, 0, 1);
      const count = Math.max(6, Math.round(8 + domeWidth * 78 * (0.34 + topEase * 0.66)));
      const rowShift = row % 2 ? 0.5 : 0;

      for (let i = 0; i < count; i += 1) {
        const t = (i + rowShift) / count;
        const xNorm = (t - 0.5) * 2;

        if (Math.abs(xNorm) > 0.995) continue;

        points.push({
          row,
          v,
          xNorm,
          t,
          jitterX: (random() - 0.5) * 0.1,
          jitterY: (random() - 0.5) * 0.13,
          base: 0.78 + random() * 0.22,
          glyphPick: random(),
          wave: random() * Math.PI * 2,
        });
      }
    }
  }

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
      makePoints();
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

  function isProjectionVisible() {
    const projection = element.closest<HTMLElement>("[data-os-fullscreen]");
    return !projection || projection.getAttribute("aria-hidden") !== "true";
  }

  function shouldAnimate() {
    return document.visibilityState === "visible" && isProjectionVisible();
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

    const radiusX = Math.min(width * 0.43, height * 1.08);
    const radiusY = Math.min(height * 0.74, radiusX * 0.88);
    const cx = width * 0.5;
    const cy = height * 1.03;
    const speed = reducedMotionQuery.matches ? 0 : 0.064;
    rotation = wrap01(rotation + speed * elapsed);

    const targetLookX = hasPointer ? clamp((pointerX - cx) / (radiusX * 1.05), -1, 1) : 0;
    const targetLookY = hasPointer ? clamp((pointerY - (cy - radiusY * 0.48)) / (radiusY * 0.85), -1, 1) : 0;
    lookX += (targetLookX - lookX) * 0.035;
    lookY += (targetLookY - lookY) * 0.035;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    points.forEach((point) => {
      const visibleWidth = Math.sqrt(Math.max(0, 1 - (1 - point.v) * (1 - point.v)));
      const xCurve = point.xNorm * visibleWidth;
      const edgeFade = clamp((1 - Math.abs(point.xNorm)) * 2.5, 0, 1);
      const topFade = clamp((point.v - 0.02) / 0.16, 0.56, 1);
      const rowScale = 0.52 + point.v * 0.62;
      const parallax = Math.sin((point.t + rotation) * Math.PI * 2) * 4.6 * visibleWidth;
      const faceWeight = clamp((1 - Math.abs(point.xNorm) * 0.78) * (0.45 + point.v * 0.55), 0, 1);
      const lookOffsetX = lookX * radiusX * 0.055 * faceWeight;
      const lookOffsetY = lookY * radiusY * 0.035 * faceWeight;
      const x = cx + xCurve * radiusX + point.jitterX * 8 + parallax + lookOffsetX;
      const y = cy - radiusY + point.v * radiusY + point.jitterY * 8 + lookOffsetY;

      if (x < -36 || x > width + 36 || y < -36 || y > height + 36) {
        return;
      }

      const surfaceU = wrap01(point.t - rotation);
      const surfaceV = point.v;
      const land = landValue(surfaceU, surfaceV);
      const landThreshold = 0.36;
      const isLand = surfaceV > 0.22 && land > landThreshold;
      const glyph = isLand ? "#" : point.glyphPick > 0.52 ? "%" : "x";
      const localNoise = noise(surfaceU + 0.13, surfaceV + 0.27);
      const pointerDistance = Math.hypot(x - pointerX, y - pointerY);
      const hover = pointerInside ? clamp(1 - pointerDistance / 118, 0, 1) : 0;
      const fontSize = (5.8 + rowScale * 4.75) * (1 - hover * 0.34);
      const oceanFlicker = isLand ? 0 : Math.sin(now * 0.0014 + point.wave + surfaceU * 9) * 0.035;
      const landAlpha = 0.54 + localNoise * 0.12 + Math.max(0, land - landThreshold) * 0.18;
      const oceanAlpha = 0.15 + localNoise * 0.12 + oceanFlicker;
      const alpha = (isLand ? landAlpha : oceanAlpha) * edgeFade * topFade * point.base * (1 - hover * 0.45);
      const color = mixRgb(isLand ? LAND : OCEAN, STAR, hover * 0.42);

      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0.015, 0.68);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.font = `780 ${fontSize.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(glyph, x, y);
      ctx.restore();
    });

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
  const projection = element.closest<HTMLElement>("[data-os-fullscreen]");
  if (projection) {
    projectionObserver = new MutationObserver(syncFrameLoop);
    projectionObserver.observe(projection, { attributes: true, attributeFilter: ["aria-hidden"] });
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
    projectionObserver?.disconnect();

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
