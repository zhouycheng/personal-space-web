/** Layout is stable between viewport, scroll and renderer resize notifications. */
export function createStudioBounds(mount: HTMLElement, canvas: HTMLCanvasElement, signal: AbortSignal) {
  let mountRect: DOMRect | undefined, canvasRect: DOMRect | undefined;
  let width = window.innerWidth, height = window.innerHeight;
  function invalidate() { mountRect = canvasRect = undefined; }
  function checkViewport() {
    if (width === window.innerWidth && height === window.innerHeight) return;
    width = window.innerWidth; height = window.innerHeight; invalidate();
  }
  window.addEventListener('resize', invalidate, { signal });
  window.addEventListener('scroll', invalidate, { capture: true, passive: true, signal });
  return {
    invalidate,
    mount() { checkViewport(); return mountRect ??= mount.getBoundingClientRect(); },
    canvas() { checkViewport(); return canvasRect ??= canvas.getBoundingClientRect(); },
  };
}
