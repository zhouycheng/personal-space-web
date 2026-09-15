import { canOpenFile, snapFileIndex, type FileGesture } from "./fileGesture";

export function setupStudioGallery(root: HTMLElement) {
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
  const active = () => page.classList.contains("is-active") && !document.hidden;
  const browsing = () => active() && !dialog.open;
  const fileAt = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLButtonElement>("[data-gallery-file]") : null;
  const maximum = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const stride = () => (cards[0]?.getBoundingClientRect().width ?? 0) + (parseFloat(getComputedStyle(track).gap) || 0);
  function snap(index: number, immediate = false) {
    selectedIndex = Math.max(0, Math.min(cards.length - 1, index));
    cards.forEach((card, index) => {
      card.dataset.filePosition = index < selectedIndex ? "left" : index > selectedIndex ? "right" : "current";
    });
    viewport.scrollTo({ left: Math.min(maximum(), selectedIndex * stride()), behavior: immediate || reduce.matches ? "instant" : "smooth" });
  }
  function settle(displacement: number) {
    snap(snapFileIndex(selectedIndex, displacement, stride(), cards.length));
  }

  function resetGesture() {
    if (gesture && viewport.hasPointerCapture(gesture.pointerId)) viewport.releasePointerCapture(gesture.pointerId);
    gesture = null;
    viewport.classList.remove("is-dragging");
  }
  function stop() {
    clearTimeout(wheelTimer); wheelTimer = 0; wheelDisplacement = 0;
    resetGesture();
    viewport.scrollTo({ left: viewport.scrollLeft, behavior: "instant" });
  }
  viewport.addEventListener("pointerdown", event => {
    if (!browsing() || event.button !== 0 || !event.isPrimary) { resetGesture(); return; }
    stop();
    gesture = { id: fileAt(event.target)?.dataset.galleryFile, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, moved: false, ended: false };
  }, options);
  window.addEventListener("pointermove", event => {
    if (!gesture || gesture.ended || event.pointerId !== gesture.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture.moved = true;
    if (gesture.moved) {
      viewport.classList.add("is-dragging");
      if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
      viewport.scrollLeft = gesture.scrollLeft + Math.max(-stride(), Math.min(stride(), gesture.x - event.clientX));
    }
  }, options);
  window.addEventListener("pointerup", event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6 ||
      Math.abs(viewport.scrollLeft - gesture.scrollLeft) > 6;
    gesture.ended = true;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    viewport.classList.remove("is-dragging");
    if (gesture.moved) settle(gesture.x - event.clientX);
  }, options);
  window.addEventListener("pointercancel", () => { resetGesture(); if (browsing()) snap(selectedIndex); }, options);
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
  const observer = new MutationObserver(() => {
    if (!active()) { stop(); void close(true); }
    else snap(selectedIndex, true);
  });
  observer.observe(page, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", () => { stop(); if (active()) snap(selectedIndex, true); if (dialog.classList.contains("is-closing")) void close(true); }, options);
  reduce.addEventListener("change", () => { stop(); snap(selectedIndex, true); if (dialog.classList.contains("is-closing")) void close(true); }, options);
  window.addEventListener("resize", () => { stop(); if (active()) snap(selectedIndex, true); }, options);
  window.addEventListener("pagehide", event => {
    stop(); void close(true);
    if (!event.persisted) { observer.disconnect(); events.abort(); }
  }, options);
  window.addEventListener("pageshow", () => { if (active()) snap(selectedIndex, true); }, options);
  if (active()) snap(selectedIndex, true);
}
