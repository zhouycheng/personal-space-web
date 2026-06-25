type CursorState = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

const INITIAL_STATE: CursorState = {
  x: 0,
  y: 0,
  scale: 1,
  opacity: 0,
};

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function hasVisibleDelta(current: CursorState, target: CursorState) {
  return (
    Math.abs(current.x - target.x) > 0.18 ||
    Math.abs(current.y - target.y) > 0.18 ||
    Math.abs(current.scale - target.scale) > 0.01 ||
    Math.abs(current.opacity - target.opacity) > 0.01
  );
}

function applyCursorState(element: HTMLElement, state: CursorState) {
  element.style.setProperty("--cursor-x", `${state.x.toFixed(3)}px`);
  element.style.setProperty("--cursor-y", `${state.y.toFixed(3)}px`);
  element.style.setProperty("--cursor-scale", state.scale.toFixed(3));
  element.style.setProperty("--cursor-opacity", state.opacity.toFixed(3));
}

export function initCursorRevealHero(element: HTMLElement) {
  if (element.dataset.cursorRevealBound === "true") {
    return () => {};
  }

  element.dataset.cursorRevealBound = "true";

  const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const current: CursorState = { ...INITIAL_STATE };
  const target: CursorState = { ...INITIAL_STATE };
  let frameId: number | null = null;
  let active = false;

  const supportsMask = () => pointerQuery.matches && !reducedMotionQuery.matches;

  const queueFrame = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(animate);
  };

  const setActive = (nextActive: boolean) => {
    active = nextActive && supportsMask();
    element.dataset.cursorActive = String(active);
  };

  const reset = (immediate = false) => {
    Object.assign(target, INITIAL_STATE);
    setActive(false);

    if (immediate) {
      Object.assign(current, INITIAL_STATE);
      applyCursorState(element, current);
      return;
    }

    queueFrame();
  };

  const animate = () => {
    current.x = lerp(current.x, target.x, 0.16);
    current.y = lerp(current.y, target.y, 0.16);
    current.scale = lerp(current.scale, target.scale, 0.2);
    current.opacity = lerp(current.opacity, target.opacity, 0.24);

    applyCursorState(element, current);

    if (hasVisibleDelta(current, target)) {
      frameId = window.requestAnimationFrame(animate);
      return;
    }

    frameId = null;
  };

  const updateTargetFromPointer = (event: PointerEvent, opacity: number) => {
    if (!supportsMask() || (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen")) {
      return;
    }

    const rect = element.getBoundingClientRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    target.opacity = opacity;
    setActive(opacity > 0);
    queueFrame();
  };

  const handlePointerMove = (event: PointerEvent) => {
    updateTargetFromPointer(event, 1);
  };

  const handlePointerDown = (event: PointerEvent) => {
    updateTargetFromPointer(event, 1);
    target.scale = 0.92;
    queueFrame();
  };

  const handlePointerUp = (event: PointerEvent) => {
    updateTargetFromPointer(event, 1);
    target.scale = 1;
    queueFrame();
  };

  const handleCapabilityChange = () => {
    if (!supportsMask()) {
      reset(true);
    }
  };

  element.addEventListener("pointermove", handlePointerMove, { passive: true });
  element.addEventListener("pointerdown", handlePointerDown);
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("pointerleave", () => reset(false));
  window.addEventListener("blur", () => reset(false));
  pointerQuery.addEventListener("change", handleCapabilityChange);
  reducedMotionQuery.addEventListener("change", handleCapabilityChange);

  return () => {
    element.removeEventListener("pointermove", handlePointerMove);
    element.removeEventListener("pointerdown", handlePointerDown);
    element.removeEventListener("pointerup", handlePointerUp);
    pointerQuery.removeEventListener("change", handleCapabilityChange);
    reducedMotionQuery.removeEventListener("change", handleCapabilityChange);

    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }

    delete element.dataset.cursorRevealBound;
    delete element.dataset.cursorActive;
  };
}

export function initCursorRevealHeroes() {
  document
    .querySelectorAll<HTMLElement>("[data-cursor-reveal-hero]")
    .forEach((element) => initCursorRevealHero(element));
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCursorRevealHeroes, { once: true });
  } else {
    initCursorRevealHeroes();
  }
}
