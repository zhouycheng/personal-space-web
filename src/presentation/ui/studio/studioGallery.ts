import { canOpenFile, snapFileIndex, type FileGesture } from "../../interaction/studio/fileGesture.ts";
import { createDomInstances } from '../../../justin-kit/runtime/domInstances.ts';

const mounted = new WeakMap<HTMLElement, () => void>();

export function setupStudioGallery(root: HTMLElement) {
  const existing = mounted.get(root);
  if (existing) return existing;
  const viewport = root.querySelector<HTMLElement>("[data-gallery-viewport]")!;
  const track = root.querySelector<HTMLElement>(".gallery-track")!;
  const dialog = root.querySelector<HTMLDialogElement>("[data-gallery-detail]")!;
  const page = root.closest<HTMLElement>(".app-page")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const options = { signal: events.signal };
  const cards = [...root.querySelectorAll<HTMLElement>(".gallery-item")];
  let gesture: FileGesture | null = null;
  let trigger: HTMLButtonElement | null = null;
  let closeToken = 0;
  let selectedIndex = 0;
  let wheelTimer = 0;
  let wheelDisplacement = 0;
  let wheelStart = 0;
  let cachedLayout: { stride: number; maximum: number } | null = null;
  let dragFrame = 0;
  let dragPoint: { x: number; y: number; pointerId: number } | null = null;
  let suspended = false;
  let disposed = false;
  const active = () => !disposed && !suspended && page.classList.contains("is-active") && !document.hidden;
  const browsing = () => active() && !dialog.open;
  const fileAt = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLButtonElement>("[data-gallery-file]") : null;
  // Measure the untransformed layout once, before changing card styles. The
  // page's entrance scale must not become part of the cached scroll distance.
  const layout = () => cachedLayout ??= {
    stride: (cards[0]?.offsetWidth ?? 0) + (parseFloat(getComputedStyle(track).gap) || 0),
    maximum: Math.max(0, viewport.scrollWidth - viewport.clientWidth),
  };
  const stride = () => layout().stride;
  function snap(index: number, immediate = false) {
    const measured = layout();
    selectedIndex = Math.max(0, Math.min(cards.length - 1, index));
    cards.forEach((card, index) => {
      const position = index < selectedIndex ? "left" : index > selectedIndex ? "right" : "current";
      if (card.dataset.filePosition !== position) card.dataset.filePosition = position;
    });
    viewport.scrollTo({ left: Math.min(measured.maximum, selectedIndex * measured.stride), behavior: immediate || reduce.matches ? "instant" : "smooth" });
  }
  function settle(displacement: number) {
    snap(snapFileIndex(selectedIndex, displacement, stride(), cards.length));
  }

  function resetGesture() {
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    dragPoint = null;
    if (gesture && viewport.hasPointerCapture(gesture.pointerId)) viewport.releasePointerCapture(gesture.pointerId);
    gesture = null;
    viewport.classList.remove("is-dragging");
  }
  function applyDragPoint() {
    dragFrame = 0;
    const point = dragPoint;
    dragPoint = null;
    if (!point || !gesture || gesture.ended) return;
    if (!gesture.moved) return;
    viewport.classList.add("is-dragging");
    if (!viewport.hasPointerCapture(point.pointerId)) viewport.setPointerCapture(point.pointerId);
    const step = stride();
    viewport.scrollLeft = gesture.scrollLeft + Math.max(-step, Math.min(step, gesture.x - point.x));
  }
  function stop() {
    clearTimeout(wheelTimer); wheelTimer = 0; wheelDisplacement = 0;
    resetGesture();
    viewport.scrollTo({ left: viewport.scrollLeft, behavior: "instant" });
  }
  viewport.addEventListener("pointerdown", event => {
    if (!browsing() || event.button !== 0 || !event.isPrimary) { resetGesture(); return; }
    stop();
    stride();
    gesture = { id: fileAt(event.target)?.dataset.galleryFile, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, moved: false, ended: false };
  }, options);
  window.addEventListener("pointermove", event => {
    if (!gesture || gesture.ended || event.pointerId !== gesture.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture.moved = true;
    dragPoint = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    if (!dragFrame) dragFrame = requestAnimationFrame(applyDragPoint);
  }, options);
  window.addEventListener("pointerup", event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6 ||
      Math.abs(viewport.scrollLeft - gesture.scrollLeft) > 6;
    cancelAnimationFrame(dragFrame);
    dragPoint = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    applyDragPoint();
    gesture.ended = true;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    viewport.classList.remove("is-dragging");
    if (gesture.moved) settle(gesture.x - event.clientX);
  }, options);
  window.addEventListener("pointercancel", () => { resetGesture(); if (browsing()) snap(selectedIndex); }, options);
  window.addEventListener("blur", stop, options);
  viewport.addEventListener("dragstart", event => event.preventDefault(), options);
  viewport.addEventListener("wheel", event => {
    if (!browsing() || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (gesture && !gesture.ended) return;
    if (!wheelTimer) { stop(); wheelStart = viewport.scrollLeft; }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    wheelDisplacement += delta * unit;
    viewport.scrollLeft = wheelStart + Math.max(-stride(), Math.min(stride(), wheelDisplacement));
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheelTimer = 0; settle(wheelDisplacement); wheelDisplacement = 0; }, 140);
  }, { ...options, passive: false });
  viewport.addEventListener("keydown", event => {
    if (!browsing()) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); stop(); snap(selectedIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); stop(); snap(event.key === "Home" ? 0 : cards.length - 1);
    }
  }, options);
  viewport.addEventListener("focusin", event => {
    const card = fileAt(event.target)?.closest<HTMLElement>(".gallery-item");
    if (!card || !browsing() || gesture) return;
    stop(); snap(cards.indexOf(card));
  }, options);

  async function close(immediate = false) {
    if (!dialog.open) return;
    if (!immediate && dialog.classList.contains("is-closing")) return;
    const token = ++closeToken;
    if (!immediate && !reduce.matches) {
      dialog.classList.add("is-closing");
      await Promise.all(dialog.getAnimations().map(animation => animation.finished.catch(() => {})));
    }
    if (token !== closeToken) return;
    dialog.close();
    dialog.classList.remove("is-closing");
  }
  root.addEventListener("click", event => {
    const button = fileAt(event.target);
    if (button && browsing()) {
      const allowed = canOpenFile(gesture, button.dataset.galleryFile!, event);
      // A drag may dispatch click after pointerup; do not cancel its snap animation.
      resetGesture();
      if (!allowed) { event.preventDefault(); return; }
      const index = cards.indexOf(button.closest<HTMLElement>(".gallery-item")!);
      stop();
      if (index !== selectedIndex) { snap(index); return; }
      snap(index, true);
      trigger = button;
      dialog.querySelector("h2")!.textContent = button.closest("article")!.querySelector("h2")!.textContent;
      dialog.querySelectorAll<HTMLElement>("[data-gallery-content]").forEach(content => content.hidden = content.dataset.galleryContent !== button.dataset.galleryFile);
      closeToken++;
      dialog.classList.remove("is-closing");
      dialog.showModal();
      dialog.scrollTop = 0;
    }
    if (event.target instanceof Element && event.target.closest(".gallery-detail-close")) void close();
  }, options);
  dialog.addEventListener("cancel", event => { event.preventDefault(); void close(); }, options);
  dialog.addEventListener("close", () => { if (active()) trigger?.focus({ preventScroll: true }); }, options);
  let pageActive = active();
  const observer = new MutationObserver(() => {
    const nextActive = active();
    if (nextActive === pageActive) return;
    pageActive = nextActive;
    if (!nextActive) { stop(); void close(true); }
    else { cachedLayout = null; snap(selectedIndex, true); }
  });
  observer.observe(page, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", () => { stop(); if (active()) snap(selectedIndex, true); if (dialog.classList.contains("is-closing")) void close(true); }, options);
  reduce.addEventListener("change", () => { stop(); snap(selectedIndex, true); if (dialog.classList.contains("is-closing")) void close(true); }, options);
  const layoutChanged = () => {
    cachedLayout = null;
    stop();
    if (active()) snap(selectedIndex, true);
  };
  const layoutObserver = new ResizeObserver(layoutChanged);
  layoutObserver.observe(viewport);
  if (cards[0]) layoutObserver.observe(cards[0]);
  window.addEventListener("resize", layoutChanged, options);
  window.addEventListener("pagehide", event => {
    suspended = true;
    stop(); void close(true);
    if (!event.persisted) dispose();
  }, options);
  window.addEventListener("pageshow", () => { suspended = false; if (active()) snap(selectedIndex, true); }, options);
  if (active()) snap(selectedIndex, true);
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    closeToken++;
    if (dialog.open) dialog.close();
    observer.disconnect();
    layoutObserver.disconnect();
    events.abort();
    mounted.delete(root);
  }
  mounted.set(root, dispose);
  return dispose;
}

if (typeof document !== 'undefined') createDomInstances('[data-studio-gallery]', setupStudioGallery).init();
