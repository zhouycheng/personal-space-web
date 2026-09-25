import { createWindowFrames } from "./windowFrames.js";
import { createWindowGestureController } from "./windowGestures.js";
import { createDesktopContentRenderer } from "./desktopContent.js";

export function createDesktopWindowController({
  entryById, iconStateById, windowLayer, getWindowViewport, clamp,
  displayControlsId, windowSizeStorageKey, getViewSettings,
  iconSizeRange, labelSizeRange, defaultViewSettings,
  applyViewSettings, flushViewSettingsSave, clampNumber,
}) {
  const openWindows = new Map();
  let topWindowZ = 120;
  const SYSTEM_DISPLAY_CONTROLS_ID = displayControlsId;
  const WINDOW_SIZE_STORAGE_KEY = windowSizeStorageKey;
  const ICON_SIZE_RANGE = iconSizeRange;
  const LABEL_SIZE_RANGE = labelSizeRange;
  const DEFAULT_VIEW_SETTINGS = defaultViewSettings;

  function syncIconWindowState() {
    iconStateById.forEach((state, id) => {
      const windowState = openWindows.get(id);
      state.el.classList.toggle("is-open", Boolean(windowState));
      state.el.classList.toggle("is-minimized", Boolean(windowState?.minimized));
      state.el.classList.toggle("is-front", Boolean(windowState && windowState.z === topWindowZ && !windowState.minimized));
    });
  }

  function focusWindow(id) {
    const state = openWindows.get(id);
    if (!state) return;
    state.minimized = false;
    state.el.hidden = false;
    state.z = ++topWindowZ;
    state.el.style.zIndex = String(state.z);
    openWindows.forEach((candidate) => {
      candidate.el.classList.toggle("is-active", candidate.id === id);
    });
    syncIconWindowState();
  }

  const windowFrames = createWindowFrames({ getWindowViewport, clamp, openWindows, storageKey: WINDOW_SIZE_STORAGE_KEY });
  const { clampWindowFrame, saveWindowSize, applyWindowFrame, applyFullscreenFrame, layoutWindowsForViewport, getDefaultWindowFrame, makeFileIcon } = windowFrames;

  function createWindow(entry) {
    const frame = getDefaultWindowFrame(entry);
    const windowEl = document.createElement("section");
    windowEl.className = "macos-window";
    windowEl.setAttribute("data-macos-window", entry.id);
    windowEl.setAttribute("aria-label", entry.window.title);

    const titlebar = document.createElement("div");
    titlebar.className = "macos-window-titlebar";

    const controls = document.createElement("div");
    controls.className = "macos-window-controls";

    [
      ["close", "关闭"],
      ["minimize", "最小化"],
      ["fullscreen", "全屏"],
    ].forEach(([action, label]) => {
      const control = document.createElement("button");
      control.type = "button";
      control.className = `macos-window-control macos-window-control--${action}`;
      control.dataset.windowAction = action;
      control.setAttribute("aria-label", `${label} ${entry.window.title}`);
      controls.append(control);
    });

    const title = document.createElement("h2");
    title.textContent = entry.window.title;

    const kind = document.createElement("span");
    kind.className = "macos-window-kind";
    kind.textContent = getWindowKindLabel(entry);

    titlebar.append(controls, title, kind);

    const body = document.createElement("div");
    body.className = "macos-window-body";

    const resizeHandle = document.createElement("span");
    resizeHandle.className = "macos-window-resize-handle";
    resizeHandle.setAttribute("aria-hidden", "true");

    windowEl.append(titlebar, body, resizeHandle);

    const state = {
      id: entry.id,
      entry,
      el: windowEl,
      body,
      z: ++topWindowZ,
      minimized: false,
      fullscreen: false,
      restoreFrame: null,
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
    };

    windowEl.style.zIndex = String(state.z);
    applyWindowFrame(state, frame);

    windowEl.addEventListener("pointerdown", () => focusWindow(entry.id));
    titlebar.addEventListener("pointerdown", (event) => windowGestures.startDrag(event, state));
    resizeHandle.addEventListener("pointerdown", (event) => windowGestures.startResize(event, state));
    controls.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.windowAction;
      if (!action) return;
      event.stopPropagation();
      handleWindowAction(entry.id, action);
    });

    return state;
  }

  function openWindow(id) {
    const existing = openWindows.get(id);
    if (existing) {
      focusWindow(id);
      return;
    }

    const entry = entryById.get(id);
    if (!entry) return;
    const state = createWindow(entry);
    openWindows.set(entry.id, state);
    windowLayer.append(state.el);
    focusWindow(entry.id);
    void renderWindowContent(state);
  }

  function getWindowKindLabel(entry) {
    if (entry.kind === "folder") return "Finder";
    if (entry.kind === "system") return "System";
    return entry.kind.toUpperCase();
  }

  function openDisplayControlsWindow() {
    openWindow(SYSTEM_DISPLAY_CONTROLS_ID);
  }

  function closeWindow(id) {
    const state = openWindows.get(id);
    if (!state) return;
    state.el.remove();
    openWindows.delete(id);
    syncIconWindowState();
  }

  function minimizeWindow(id) {
    const state = openWindows.get(id);
    if (!state) return;
    state.minimized = true;
    state.el.hidden = true;
    syncIconWindowState();
  }

  function toggleWindowFullscreen(id) {
    const state = openWindows.get(id);
    if (!state) return;
    focusWindow(id);

    if (state.fullscreen) {
      state.fullscreen = false;
      state.el.classList.remove("is-fullscreen");
      applyWindowFrame(state, clampWindowFrame(
        state.restoreFrame || {
          left: 78,
          top: 68,
          width: state.entry.window.width,
          height: state.entry.window.height,
        },
        state.entry.window.minWidth,
        state.entry.window.minHeight,
      ));
      state.restoreFrame = null;
      return;
    }

    state.restoreFrame = {
      left: state.left,
      top: state.top,
      width: state.width,
      height: state.height,
    };
    state.fullscreen = true;
    state.el.classList.add("is-fullscreen");
    applyFullscreenFrame(state);
  }

  function handleWindowAction(id, action) {
    if (action === "close") closeWindow(id);
    if (action === "minimize") minimizeWindow(id);
    if (action === "fullscreen") toggleWindowFullscreen(id);
  }

  function clearWindowState() {
    openWindows.forEach((state) => state.el.remove());
    openWindows.clear();
    windowFrames.resetCascade();
    windowGestures.cancel();
    syncIconWindowState();
  }

  const windowGestures = createWindowGestureController({ focusWindow, openWindows, applyWindowFrame, clampWindowFrame, saveWindowSize });
  const renderWindowContent = createDesktopContentRenderer({ makeFileIcon, openWindow, getViewSettings, ICON_SIZE_RANGE, LABEL_SIZE_RANGE, DEFAULT_VIEW_SETTINGS, applyViewSettings, flushViewSettingsSave, clampNumber });

  return { openWindow, openDisplayControlsWindow, clearWindowState, layoutWindowsForViewport, syncIconWindowState };
}
