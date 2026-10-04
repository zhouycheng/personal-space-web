export function createWindowGestureController(context) {
  const { focusWindow, openWindows, applyWindowFrame, clampWindowFrame, saveWindowSize } = context;
  let activeWindowGesture = null;
  let windowGestureFrame = 0;
  let windowGestureEvent = null;
  function startWindowDrag(event, state) {
    const target = event.target;
    if (event.button !== 0 || state.fullscreen || (target instanceof Element && target.closest("[data-window-action]"))) return;
    event.preventDefault();
    cancel();
    focusWindow(state.id);
    activeWindowGesture = {
      pointerId: event.pointerId,
      type: "drag",
      id: state.id,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: state.left,
      startTop: state.top,
      startWidth: state.width,
      startHeight: state.height,
      previousTranslate: state.el.style.translate,
      previousWillChange: state.el.style.willChange,
    };
    state.el.style.willChange='translate';
    document.body.classList.add("is-macos-window-gesturing");
    window.addEventListener("pointermove", handleWindowGestureMove);
    window.addEventListener("pointerup", endWindowGesture);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  }

  function startWindowResize(event, state) {
    if (event.button !== 0 || state.fullscreen) return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
    focusWindow(state.id);
    activeWindowGesture = {
      pointerId: event.pointerId,
      type: "resize",
      id: state.id,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: state.left,
      startTop: state.top,
      startWidth: state.width,
      startHeight: state.height,
    };
    document.body.classList.add("is-macos-window-gesturing", "is-macos-window-resizing");
    window.addEventListener("pointermove", handleWindowGestureMove);
    window.addEventListener("pointerup", endWindowGesture);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  }

  function applyWindowGestureMove(event) {
    if (!activeWindowGesture) return;
    const state = openWindows.get(activeWindowGesture.id);
    if (!state) return;
    const dx = event.clientX - activeWindowGesture.startX;
    const dy = event.clientY - activeWindowGesture.startY;
    const nextFrame = activeWindowGesture.type === "drag"
      ? {
          left: activeWindowGesture.startLeft + dx,
          top: activeWindowGesture.startTop + dy,
          width: state.width,
          height: state.height,
        }
      : {
          left: state.left,
          top: state.top,
          width: activeWindowGesture.startWidth + dx,
          height: activeWindowGesture.startHeight + dy,
        };
    const frame=clampWindowFrame(nextFrame, state.entry.window.minWidth, state.entry.window.minHeight);
    if(activeWindowGesture.type==='drag'){
      state.left=frame.left;state.top=frame.top;
      // Individual translate composes with the window's existing transform animations.
      state.el.style.translate=`${frame.left-activeWindowGesture.startLeft}px ${frame.top-activeWindowGesture.startTop}px`;
    }else applyWindowFrame(state,frame);
  }

  function commitWindowGestureMove() {
    windowGestureFrame = 0;
    const event = windowGestureEvent;
    windowGestureEvent = null;
    if (event) applyWindowGestureMove(event);
  }

  function handleWindowGestureMove(event) {
    if (event.pointerId !== activeWindowGesture?.pointerId) return;
    windowGestureEvent = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (windowGestureFrame) return;
    windowGestureFrame = window.requestAnimationFrame(commitWindowGestureMove);
  }

  function flushWindowGestureMove() {
    if (windowGestureFrame) {
      window.cancelAnimationFrame(windowGestureFrame);
      windowGestureFrame = 0;
    }
    commitWindowGestureMove();
  }

  function endWindowGesture(event) {
    if (event.pointerId !== activeWindowGesture?.pointerId) return;
    windowGestureEvent = { clientX: event.clientX, clientY: event.clientY };
    flushWindowGestureMove();
    if (activeWindowGesture?.type === "resize") {
      saveWindowSize(openWindows.get(activeWindowGesture.id));
    }
    cancel();
  }
  function cancel() {
    if (windowGestureFrame) window.cancelAnimationFrame(windowGestureFrame);
    windowGestureFrame = 0;
    windowGestureEvent = null;
    if(activeWindowGesture?.type==='drag'){
      const state=openWindows.get(activeWindowGesture.id);
      if(state){
        state.el.style.translate=activeWindowGesture.previousTranslate;
        state.el.style.willChange=activeWindowGesture.previousWillChange;
        applyWindowFrame(state,state);
      }
    }
    activeWindowGesture = null;
    document.body.classList.remove("is-macos-window-gesturing", "is-macos-window-resizing");
    window.removeEventListener("pointermove", handleWindowGestureMove);
    window.removeEventListener("pointerup", endWindowGesture);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("blur", cancel);
  }
  return { startDrag: startWindowDrag, startResize: startWindowResize, cancel };
}
