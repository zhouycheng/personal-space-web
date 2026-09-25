export function createWindowGestureController(context) {
  const { focusWindow, openWindows, applyWindowFrame, clampWindowFrame, saveWindowSize } = context;
  let activeWindowGesture = null;
  let windowGestureFrame = 0;
  let windowGestureEvent = null;
  function startWindowDrag(event, state) {
    const target = event.target;
    if (event.button !== 0 || state.fullscreen || (target instanceof Element && target.closest("[data-window-action]"))) return;
    event.preventDefault();
    focusWindow(state.id);
    activeWindowGesture = {
      type: "drag",
      id: state.id,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: state.left,
      startTop: state.top,
      startWidth: state.width,
      startHeight: state.height,
    };
    document.body.classList.add("is-macos-window-gesturing");
    window.addEventListener("pointermove", handleWindowGestureMove);
    window.addEventListener("pointerup", endWindowGesture, { once: true });
  }

  function startWindowResize(event, state) {
    if (event.button !== 0 || state.fullscreen) return;
    event.preventDefault();
    event.stopPropagation();
    focusWindow(state.id);
    activeWindowGesture = {
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
    window.addEventListener("pointerup", endWindowGesture, { once: true });
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
    applyWindowFrame(state, clampWindowFrame(nextFrame, state.entry.window.minWidth, state.entry.window.minHeight));
  }

  function commitWindowGestureMove() {
    windowGestureFrame = 0;
    const event = windowGestureEvent;
    windowGestureEvent = null;
    if (event) applyWindowGestureMove(event);
  }

  function handleWindowGestureMove(event) {
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

  function endWindowGesture() {
    flushWindowGestureMove();
    if (activeWindowGesture?.type === "resize") {
      saveWindowSize(openWindows.get(activeWindowGesture.id));
    }
    activeWindowGesture = null;
    document.body.classList.remove("is-macos-window-gesturing", "is-macos-window-resizing");
    window.removeEventListener("pointermove", handleWindowGestureMove);
  }
  function cancel() {
    if (windowGestureFrame) window.cancelAnimationFrame(windowGestureFrame);
    windowGestureFrame = 0;
    windowGestureEvent = null;
    activeWindowGesture = null;
    document.body.classList.remove("is-macos-window-gesturing", "is-macos-window-resizing");
    window.removeEventListener("pointermove", handleWindowGestureMove);
  }
  return { startDrag: startWindowDrag, startResize: startWindowResize, cancel };
}
