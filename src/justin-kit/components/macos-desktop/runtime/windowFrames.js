export function createWindowFrames({ getWindowViewport, clamp, openWindows, storageKey }) {
  let windowCascadeIndex = 0;
  function clampWindowFrame(frame, minWidth, minHeight) {
    const viewport = getWindowViewport();
    const safeTop = 44;
    const safeBottom = 96;
    const safeSide = 12;
    const effectiveMinWidth = Math.min(minWidth, Math.max(280, viewport.width - safeSide * 2));
    const effectiveMinHeight = Math.min(minHeight, Math.max(240, viewport.height - safeTop - 24));
    const maxWidth = Math.max(effectiveMinWidth, viewport.width - safeSide * 2);
    const maxHeight = Math.max(effectiveMinHeight, viewport.height - safeTop - safeBottom);
    const width = clamp(frame.width, effectiveMinWidth, maxWidth);
    const height = clamp(frame.height, effectiveMinHeight, maxHeight);
    const maxLeft = Math.max(safeSide, viewport.width - width - safeSide);
    const maxTop = Math.max(safeTop, viewport.height - height - safeBottom);

    return {
      left: clamp(frame.left, safeSide, maxLeft),
      top: clamp(frame.top, safeTop, maxTop),
      width,
      height,
    };
  }

  function readStoredWindowSizes() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readStoredWindowSize(id) {
    const stored = readStoredWindowSizes()[id];
    if (!stored || typeof stored !== "object") return null;
    const width = Number(stored.width);
    const height = Number(stored.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height };
  }

  function saveWindowSize(state) {
    if (!state || state.fullscreen) return;
    const sizes = readStoredWindowSizes();
    sizes[state.id] = {
      width: Math.round(state.width),
      height: Math.round(state.height),
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(sizes));
    } catch {
      // The window still opens with its default size when storage is unavailable.
    }
  }

  function applyWindowFrame(state, frame) {
    state.left = frame.left;
    state.top = frame.top;
    state.width = frame.width;
    state.height = frame.height;
    state.el.style.left = `${state.left}px`;
    state.el.style.top = `${state.top}px`;
    state.el.style.width = `${state.width}px`;
    state.el.style.height = `${state.height}px`;
  }

  function applyFullscreenFrame(state) {
    const viewport = getWindowViewport();
    applyWindowFrame(state, {
      left: 12,
      top: 42,
      width: Math.max(280, viewport.width - 24),
      height: Math.max(240, viewport.height - 124),
    });
  }

  function layoutWindowsForViewport() {
    openWindows.forEach((state) => {
      if (state.fullscreen) {
        applyFullscreenFrame(state);
        return;
      }

      applyWindowFrame(state, clampWindowFrame(
        {
          left: state.left,
          top: state.top,
          width: state.width,
          height: state.height,
        },
        state.entry.window.minWidth,
        state.entry.window.minHeight,
      ));
    });
  }

  function getDefaultWindowFrame(entry) {
    const viewport = getWindowViewport();
    const cascade = windowCascadeIndex % 7;
    const storedSize = readStoredWindowSize(entry.id);
    windowCascadeIndex += 1;
    return clampWindowFrame(
      {
        left: 78 + cascade * 32,
        top: 68 + cascade * 24,
        width: Math.min(storedSize?.width || entry.window.width, viewport.width - 32),
        height: Math.min(storedSize?.height || entry.window.height, viewport.height - 132),
      },
      entry.window.minWidth,
      entry.window.minHeight,
    );
  }

  function makeFileIcon(entry, className = "macos-folder-icon-art") {
    const art = document.createElement("span");
    art.className = `${className} ${className}--${entry.icon}`;
    art.setAttribute("aria-hidden", "true");

    if (entry.icon === "html" || entry.icon === "markdown") {
      const badge = document.createElement("span");
      badge.className = "macos-file-badge";
      badge.textContent = entry.icon === "html" ? ".html" : ".md";
      art.append(badge);
    }

    return art;
  }

  return { clampWindowFrame, readStoredWindowSize, saveWindowSize, applyWindowFrame, applyFullscreenFrame, layoutWindowsForViewport, getDefaultWindowFrame, makeFileIcon, resetCascade: () => { windowCascadeIndex = 0; } };
}
