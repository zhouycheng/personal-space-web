  import { createWindowFrames } from "./windowFrames.js";
  import { createWindowGestureController } from "./windowGestures.js";
  import { createDesktopContentRenderer } from "./desktopContent.js";
  import { readViewSettings as loadViewSettings, saveViewSettings as persistViewSettings, readIconPositions, saveIconPositions as persistIconPositions } from "./desktopPersistence.js";
  (() => {
    const VIEW_SETTINGS_KEY = "justin-os-desktop-view-settings";
    const WINDOW_SIZE_STORAGE_KEY = "justin-os-window-sizes";
    const DEFAULT_VIEW_SETTINGS = {
      iconSize: 48,
      labelSize: 8.5,
    };
    const ICON_SIZE_RANGE = {
      min: 40,
      max: 72,
    };
    const LABEL_SIZE_RANGE = {
      min: 7.5,
      max: 12,
    };
    const SYSTEM_DISPLAY_CONTROLS_ID = "__justin-os/display-controls";
    const SYSTEM_DISPLAY_CONTROLS_ENTRY = {
      id: SYSTEM_DISPLAY_CONTROLS_ID,
      title: "显示控制",
      kind: "system",
      icon: "system",
      window: {
        title: "显示控制",
        renderer: "display-controls",
        width: 430,
        height: 330,
        minWidth: 360,
        minHeight: 300,
      },
    };
    const ICON_RIGHT_INSET = 12;
    const ICON_COLUMN_GAP = 14;
    const ICON_ROW_GAP = 10;
    const ICON_SAFE_SIDE = 10;
    const MENU_SAFE_GAP = 8;
    const DOCK_SAFE_GAP = 12;
    const DRAG_THRESHOLD = 4;
    const SELECTION_HOLD_MS = 120;
    const SELECTION_DRAG_THRESHOLD = 6;

    document.querySelectorAll("[data-macos-desktop]").forEach((desktopRoot) => {
      initMacOsDesktop(desktopRoot);
    });

    function initMacOsDesktop(root) {
      const dataElement = root.querySelector("[data-macos-desktop-data]");
      const iconLayer = root.querySelector("[data-macos-desktop-icons]");
      const selectionBox = root.querySelector("[data-macos-selection-box]");
      const windowLayer = root.querySelector("[data-macos-window-layer]");
      if (!dataElement || !iconLayer || !selectionBox || !windowLayer) return;

      const config = readDesktopConfig(dataElement);
      const entries = config.entries || [];
      const storageKey = config.storageKey || "justin-os-desktop-icon-layout";
      const entryById = new Map();
      const iconStateById = new Map();
      const selectedIconIds = new Set();
      const openWindows = new Map();
      let viewSettings = readViewSettings();
      let iconMetrics = getIconMetrics();

      let topWindowZ = 120;
      let desktopLayoutFrame = 0;
      let viewSettingsSaveTimer = 0;
      let selectionFrame = 0;
      let selectionPendingPoint = null;
      let iconDragFrame = 0;
      let iconDragCommit = null;

      collectEntries(entries, entryById);
      entryById.set(SYSTEM_DISPLAY_CONTROLS_ID, SYSTEM_DISPLAY_CONTROLS_ENTRY);
      applyViewSettings(viewSettings, { relayout: false });

      iconLayer.querySelectorAll("[data-desktop-entry]").forEach((iconElement) => {
        const id = iconElement.dataset.desktopEntry;
        const entry = entryById.get(id);
        if (!entry) return;
        iconStateById.set(id, {
          id,
          entry,
          el: iconElement,
          left: 0,
          top: 0,
        });
        bindDesktopIcon(iconElement, id);
      });

      bindDesktopSelection();
      layoutDesktopIcons();
      syncIconWindowState();

      window.addEventListener("resize", scheduleDesktopLayout);
      window.addEventListener("justin-os-desktop:clear-windows", clearWindowState);
      window.addEventListener("justin-os-desktop:open-display-controls", openDisplayControlsWindow);
      window.addEventListener("justin-os-desktop:arrange-icons", () => arrangeDesktopIcons({ animate: true }));

      function readDesktopConfig(element) {
        try {
          return JSON.parse(element.textContent || "{}");
        } catch {
          return { entries: [], storageKey: "justin-os-desktop-icon-layout" };
        }
      }

      function collectEntries(items, target) {
        items.forEach((entry) => {
          target.set(entry.id, entry);
          if (Array.isArray(entry.children)) collectEntries(entry.children, target);
        });
      }

      function getIconViewport() {
        const rect = iconLayer.getBoundingClientRect();
        return {
          width: rect.width || window.innerWidth,
          height: rect.height || window.innerHeight,
        };
      }

      function getWindowViewport() {
        const rect = root.getBoundingClientRect();
        return {
          width: rect.width || window.innerWidth,
          height: rect.height || window.innerHeight,
        };
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function scheduleDesktopLayout() {
        if (desktopLayoutFrame) return;
        desktopLayoutFrame = window.requestAnimationFrame(() => {
          desktopLayoutFrame = 0;
          layoutDesktopIcons();
          layoutWindowsForViewport();
        });
      }

      function clampNumber(value, range, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return clamp(number, range.min, range.max);
      }

      function readViewSettings() {
        return loadViewSettings(VIEW_SETTINGS_KEY, ICON_SIZE_RANGE, LABEL_SIZE_RANGE, DEFAULT_VIEW_SETTINGS, clampNumber);
      }

      function saveViewSettings() {
        persistViewSettings(VIEW_SETTINGS_KEY, viewSettings);
      }

      function scheduleSaveViewSettings() {
        if (viewSettingsSaveTimer) window.clearTimeout(viewSettingsSaveTimer);
        viewSettingsSaveTimer = window.setTimeout(() => {
          viewSettingsSaveTimer = 0;
          saveViewSettings();
        }, 180);
      }

      function flushViewSettingsSave() {
        if (viewSettingsSaveTimer) {
          window.clearTimeout(viewSettingsSaveTimer);
          viewSettingsSaveTimer = 0;
        }
        saveViewSettings();
      }

      function getIconMetrics(settings = viewSettings) {
        const labelLineHeight = settings.labelSize * 1.25;
        const labelHeight = Math.ceil(labelLineHeight * 2);
        const width = Math.ceil(Math.max(64, settings.iconSize + 24));
        const height = Math.ceil(settings.iconSize + 5 + labelHeight + 3);

        return {
          artSize: settings.iconSize,
          labelSize: settings.labelSize,
          labelHeight,
          width,
          height,
        };
      }

      function applyViewSettings(settings, options = {}) {
        viewSettings = {
          iconSize: clampNumber(settings.iconSize, ICON_SIZE_RANGE, DEFAULT_VIEW_SETTINGS.iconSize),
          labelSize: clampNumber(settings.labelSize, LABEL_SIZE_RANGE, DEFAULT_VIEW_SETTINGS.labelSize),
        };
        iconMetrics = getIconMetrics(viewSettings);
        root.style.setProperty("--macos-icon-art-size", `${iconMetrics.artSize}px`);
        root.style.setProperty("--macos-icon-label-size", `${iconMetrics.labelSize}px`);
        root.style.setProperty("--macos-icon-label-max-height", `${iconMetrics.labelHeight}px`);
        root.style.setProperty("--macos-icon-cell-width", `${iconMetrics.width}px`);
        root.style.setProperty("--macos-icon-cell-height", `${iconMetrics.height}px`);
        if (options.persist) scheduleSaveViewSettings();
        if (options.relayout) layoutDesktopIcons({ animate: Boolean(options.animate) });
      }

      function getDesktopBounds() {
        const viewport = getIconViewport();
        const rootRect = root.getBoundingClientRect();
        const projection = root.closest("[data-os-fullscreen]");
        const menuBar = projection?.querySelector(".os-menu-bar");
        const dock = document.querySelector(".app-dock");
        let top = ICON_SAFE_SIDE;
        let bottom = viewport.height - ICON_SAFE_SIDE;

        if (menuBar) {
          const menuRect = menuBar.getBoundingClientRect();
          if (menuRect.bottom > rootRect.top && menuRect.top < rootRect.bottom) {
            top = Math.max(top, menuRect.bottom - rootRect.top + MENU_SAFE_GAP);
          }
        }

        if (dock) {
          const dockRect = dock.getBoundingClientRect();
          if (dockRect.top > rootRect.top && dockRect.top < rootRect.bottom) {
            bottom = Math.min(bottom, dockRect.top - rootRect.top - DOCK_SAFE_GAP);
          }
        }

        return {
          left: ICON_SAFE_SIDE,
          top,
          right: Math.max(ICON_SAFE_SIDE, viewport.width - ICON_SAFE_SIDE),
          bottom: Math.max(top + iconMetrics.height, bottom),
        };
      }

      function clampIconPosition(position) {
        const bounds = getDesktopBounds();
        return {
          left: clamp(position.left, bounds.left, Math.max(bounds.left, bounds.right - iconMetrics.width)),
          top: clamp(position.top, bounds.top, Math.max(bounds.top, bounds.bottom - iconMetrics.height)),
        };
      }

      function getDefaultIconPositions() {
        const bounds = getDesktopBounds();
        const availableHeight = Math.max(iconMetrics.height, bounds.bottom - bounds.top);
        const rowsPerColumn = Math.max(1, Math.floor((availableHeight + ICON_ROW_GAP) / (iconMetrics.height + ICON_ROW_GAP)));
        const positions = new Map();

        [...iconStateById.values()].forEach((state, index) => {
          const column = Math.floor(index / rowsPerColumn);
          const row = index % rowsPerColumn;
          positions.set(state.id, clampIconPosition({
            left: bounds.right - ICON_RIGHT_INSET - iconMetrics.width - column * (iconMetrics.width + ICON_COLUMN_GAP),
            top: bounds.top + row * (iconMetrics.height + ICON_ROW_GAP),
          }));
        });

        return positions;
      }

      function readStoredIconPositions() {
        return readIconPositions(storageKey);
      }

      function saveIconPositions() {
        persistIconPositions(storageKey, iconStateById);
      }

      function layoutDesktopIcons(options = {}) {
        const firstFrames = options.animate ? captureIconFrames() : null;
        const defaultPositions = getDefaultIconPositions();
        const storedPositions = readStoredIconPositions();

        iconStateById.forEach((state, id) => {
          const stored = storedPositions[id];
          const fallback = defaultPositions.get(id) || { left: 0, top: 0 };
          const next = stored && Number.isFinite(stored.left) && Number.isFinite(stored.top)
            ? clampIconPosition(stored)
            : fallback;
          applyIconPosition(state, next);
        });

        resolveIconCollisions(null, { animate: Boolean(options.animate), firstFrames });
        iconLayer.classList.add("is-ready");
      }

      function applyIconPosition(state, position) {
        state.left = position.left;
        state.top = position.top;
        state.el.style.left = `${state.left}px`;
        state.el.style.top = `${state.top}px`;
      }

      function captureIconFrames(states = [...iconStateById.values()]) {
        const frames = new Map();
        states.forEach((state) => {
          frames.set(state.id, {
            left: state.left,
            top: state.top,
          });
        });
        return frames;
      }

      function playIconFlip(state, firstFrame, options = {}) {
        if (!firstFrame) return;
        const dx = firstFrame.left - state.left;
        const dy = firstFrame.top - state.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        const icon = state.el;
        icon.classList.add("is-bumping");
        icon.style.transition = "transform 0s";
        icon.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${options.scale || 1.045})`;
        icon.getBoundingClientRect();

        window.requestAnimationFrame(() => {
          icon.style.transition = "transform 560ms cubic-bezier(0.17, 1.42, 0.28, 1)";
          icon.style.transform = "";
        });

        window.setTimeout(() => {
          icon.classList.remove("is-bumping");
          icon.style.transition = "";
          icon.style.transform = "";
        }, 620);
      }

      function animateIconsFrom(firstFrames, options = {}) {
        if (!firstFrames) return;
        iconStateById.forEach((state, id) => {
          playIconFlip(state, firstFrames.get(id), options);
        });
      }

      function arrangeDesktopIcons(options = {}) {
        const firstFrames = captureIconFrames();
        const defaultPositions = getDefaultIconPositions();
        iconStateById.forEach((state, id) => {
          applyIconPosition(state, defaultPositions.get(id) || clampIconPosition({ left: 0, top: 0 }));
        });
        resolveIconCollisions(null, { animate: false });
        if (options.animate) animateIconsFrom(firstFrames, { scale: 1.03 });
        saveIconPositions();
      }

      function syncIconSelectionState() {
        iconStateById.forEach((state, id) => {
          state.el.classList.toggle("is-selected", selectedIconIds.has(id));
        });
      }

      function clearIconSelection() {
        if (!selectedIconIds.size) return;
        selectedIconIds.clear();
        syncIconSelectionState();
      }

      function getIconLayerPoint(event) {
        const rect = iconLayer.getBoundingClientRect();
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
      }

      function clampPointToDesktop(point) {
        const bounds = getDesktopBounds();
        return {
          x: clamp(point.x, bounds.left, bounds.right),
          y: clamp(point.y, bounds.top, bounds.bottom),
        };
      }

      function getSelectionRect(start, current) {
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const right = Math.max(start.x, current.x);
        const bottom = Math.max(start.y, current.y);
        return {
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        };
      }

      function paintSelectionBox(rect) {
        selectionBox.style.left = `${rect.left}px`;
        selectionBox.style.top = `${rect.top}px`;
        selectionBox.style.width = `${rect.width}px`;
        selectionBox.style.height = `${rect.height}px`;
      }

      function hideSelectionBox() {
        selectionBox.classList.remove("is-active");
        selectionBox.style.width = "0px";
        selectionBox.style.height = "0px";
      }

      function selectIconsByRect(rect) {
        selectedIconIds.clear();
        iconStateById.forEach((state, id) => {
          if (boxesOverlap(rect, getIconBox(state))) selectedIconIds.add(id);
        });
        syncIconSelectionState();
      }

      function getSelectedIconStates() {
        return [...selectedIconIds]
          .map((id) => iconStateById.get(id))
          .filter(Boolean);
      }

      function getStatesBounds(states, positions = null) {
        if (!states.length) {
          return {
            left: 0,
            top: 0,
            right: iconMetrics.width,
            bottom: iconMetrics.height,
          };
        }

        return states.reduce((bounds, state) => {
          const position = positions?.get(state.id) || state;
          return {
            left: Math.min(bounds.left, position.left),
            top: Math.min(bounds.top, position.top),
            right: Math.max(bounds.right, position.left + iconMetrics.width),
            bottom: Math.max(bounds.bottom, position.top + iconMetrics.height),
          };
        }, {
          left: Infinity,
          top: Infinity,
          right: -Infinity,
          bottom: -Infinity,
        });
      }

      function clampDelta(value, min, max) {
        if (min > max) return (min + max) / 2;
        return clamp(value, min, max);
      }

      function getClampedGroupDelta(states, startPositions, dx, dy) {
        const bounds = getDesktopBounds();
        const groupBounds = getStatesBounds(states, startPositions);

        return {
          dx: clampDelta(dx, bounds.left - groupBounds.left, bounds.right - groupBounds.right),
          dy: clampDelta(dy, bounds.top - groupBounds.top, bounds.bottom - groupBounds.bottom),
        };
      }

      function bindDesktopSelection() {
        iconLayer.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          const target = event.target;
          if (target instanceof Element && target.closest("[data-desktop-entry]")) return;

          event.preventDefault();
          clearIconSelection();

          const startPoint = clampPointToDesktop(getIconLayerPoint(event));
          let currentPoint = startPoint;
          let didSelect = false;
          let holdReady = false;

          function maybeStartSelection() {
            if (didSelect || !holdReady) return;
            const distance = Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
            if (distance < SELECTION_DRAG_THRESHOLD) return;
            didSelect = true;
            selectionBox.classList.add("is-active");
            document.body.classList.add("is-macos-selecting");
          }

          const holdTimer = window.setTimeout(() => {
            holdReady = true;
            maybeStartSelection();
          }, SELECTION_HOLD_MS);

          iconLayer.setPointerCapture?.(event.pointerId);

          const commitSelectionMove = () => {
            selectionFrame = 0;
            if (!selectionPendingPoint) return;
            currentPoint = selectionPendingPoint;
            selectionPendingPoint = null;
            maybeStartSelection();
            if (!didSelect) return;

            const rect = getSelectionRect(startPoint, currentPoint);
            paintSelectionBox(rect);
            selectIconsByRect(rect);
          };

          const scheduleSelectionMove = (moveEvent) => {
            selectionPendingPoint = clampPointToDesktop(getIconLayerPoint(moveEvent));
            if (selectionFrame) return;
            selectionFrame = window.requestAnimationFrame(commitSelectionMove);
          };

          const flushSelectionMove = () => {
            if (selectionFrame) {
              window.cancelAnimationFrame(selectionFrame);
              selectionFrame = 0;
            }
            commitSelectionMove();
          };

          const handleMove = (moveEvent) => {
            scheduleSelectionMove(moveEvent);
          };

          const handleUp = (upEvent) => {
            flushSelectionMove();
            window.clearTimeout(holdTimer);
            iconLayer.releasePointerCapture?.(upEvent.pointerId);
            iconLayer.removeEventListener("pointermove", handleMove);
            iconLayer.removeEventListener("pointerup", handleUp);
            iconLayer.removeEventListener("pointercancel", handleUp);
            document.body.classList.remove("is-macos-selecting");
            hideSelectionBox();

            if (!didSelect) clearIconSelection();
          };

          iconLayer.addEventListener("pointermove", handleMove);
          iconLayer.addEventListener("pointerup", handleUp);
          iconLayer.addEventListener("pointercancel", handleUp);
        });
      }

      function bindDesktopIcon(iconElement, id) {
        iconElement.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          const state = iconStateById.get(id);
          if (!state) return;

          event.preventDefault();
          const startX = event.clientX;
          const startY = event.clientY;
          const shouldDragGroup = selectedIconIds.has(id) && selectedIconIds.size > 1;
          const dragStates = shouldDragGroup ? getSelectedIconStates() : [state];
          const startPositions = new Map(dragStates.map((dragState) => [
            dragState.id,
            {
              left: dragState.left,
              top: dragState.top,
            },
          ]));
          let didDrag = false;

          iconElement.setPointerCapture?.(event.pointerId);

          const applyDragMove = (dx, dy) => {
            if (!didDrag && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            didDrag = true;
            if (!selectedIconIds.has(id)) clearIconSelection();
            dragStates.forEach((dragState) => dragState.el.classList.add("is-dragging"));
            document.body.classList.add("is-macos-icon-dragging");

            if (dragStates.length > 1) {
              const delta = getClampedGroupDelta(dragStates, startPositions, dx, dy);
              dragStates.forEach((dragState) => {
                const startPosition = startPositions.get(dragState.id);
                if (!startPosition) return;
                applyIconPosition(dragState, clampIconPosition({
                  left: startPosition.left + delta.dx,
                  top: startPosition.top + delta.dy,
                }));
              });
              return;
            }

            const startPosition = startPositions.get(state.id);
            if (!startPosition) return;
            applyIconPosition(state, clampIconPosition({
              left: startPosition.left + dx,
              top: startPosition.top + dy,
            }));
          };

          const commitIconDrag = () => {
            iconDragFrame = 0;
            const commit = iconDragCommit;
            iconDragCommit = null;
            if (commit) applyDragMove(commit.dx, commit.dy);
          };

          const scheduleIconDrag = (moveEvent) => {
            iconDragCommit = {
              dx: moveEvent.clientX - startX,
              dy: moveEvent.clientY - startY,
            };
            if (iconDragFrame) return;
            iconDragFrame = window.requestAnimationFrame(commitIconDrag);
          };

          const flushIconDrag = () => {
            if (iconDragFrame) {
              window.cancelAnimationFrame(iconDragFrame);
              iconDragFrame = 0;
            }
            commitIconDrag();
          };

          const handleMove = (moveEvent) => {
            scheduleIconDrag(moveEvent);
          };

          const handleUp = (upEvent) => {
            flushIconDrag();
            iconElement.releasePointerCapture?.(upEvent.pointerId);
            iconElement.removeEventListener("pointermove", handleMove);
            iconElement.removeEventListener("pointerup", handleUp);
            iconElement.removeEventListener("pointercancel", handleUp);
            document.body.classList.remove("is-macos-icon-dragging");
            dragStates.forEach((dragState) => dragState.el.classList.remove("is-dragging"));

            if (!didDrag) {
              openWindow(id);
              return;
            }

            resolveIconCollisions(id, { animate: true });
            saveIconPositions();
          };

          iconElement.addEventListener("pointermove", handleMove);
          iconElement.addEventListener("pointerup", handleUp);
          iconElement.addEventListener("pointercancel", handleUp);
        });
      }

      function getIconBox(state) {
        return {
          left: state.left,
          top: state.top,
          right: state.left + iconMetrics.width,
          bottom: state.top + iconMetrics.height,
          centerX: state.left + iconMetrics.width / 2,
          centerY: state.top + iconMetrics.height / 2,
        };
      }

      function boxesOverlap(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      }

      function resolveIconCollisions(sourceId = null, options = {}) {
        const states = [...iconStateById.values()];
        const firstFrames = options.firstFrames || (options.animate ? captureIconFrames(states) : null);
        const bumped = new Set();

        for (let iteration = 0; iteration < 18; iteration += 1) {
          let moved = false;

          for (let aIndex = 0; aIndex < states.length; aIndex += 1) {
            for (let bIndex = aIndex + 1; bIndex < states.length; bIndex += 1) {
              const a = states[aIndex];
              const b = states[bIndex];
              const aBox = getIconBox(a);
              const bBox = getIconBox(b);
              if (!boxesOverlap(aBox, bBox)) continue;

              const overlapX = Math.min(aBox.right - bBox.left, bBox.right - aBox.left);
              const overlapY = Math.min(aBox.bottom - bBox.top, bBox.bottom - aBox.top);
              const angleSeed = (a.id.length * 17 + b.id.length * 31 + iteration * 11) % 360;
              const directionX = aBox.centerX === bBox.centerX
                ? Math.cos((angleSeed * Math.PI) / 180)
                : Math.sign(aBox.centerX - bBox.centerX);
              const directionY = aBox.centerY === bBox.centerY
                ? Math.sin((angleSeed * Math.PI) / 180)
                : Math.sign(aBox.centerY - bBox.centerY);
              const pushX = Math.max(8, overlapX / 2 + 7) * (directionX || 1);
              const pushY = Math.max(8, overlapY / 2 + 7) * (directionY || 1);
              const aWeight = sourceId === a.id ? 0.35 : 0.5;
              const bWeight = sourceId === b.id ? 0.35 : 0.5;

              applyIconPosition(a, clampIconPosition({
                left: a.left + pushX * aWeight,
                top: a.top + pushY * aWeight,
              }));
              applyIconPosition(b, clampIconPosition({
                left: b.left - pushX * bWeight,
                top: b.top - pushY * bWeight,
              }));
              bumped.add(a.el);
              bumped.add(b.el);
              moved = true;
            }
          }

          if (!moved) break;
        }

        if (firstFrames) {
          bumped.forEach((icon) => {
            const state = states.find((candidate) => candidate.el === icon);
            if (state) playIconFlip(state, firstFrames.get(state.id));
          });
          return;
        }

        bumped.forEach((icon) => {
          icon.classList.add("is-bumping");
          window.setTimeout(() => icon.classList.remove("is-bumping"), 360);
        });
      }

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
      const renderWindowContent = createDesktopContentRenderer({ makeFileIcon, openWindow, getViewSettings: () => viewSettings, ICON_SIZE_RANGE, LABEL_SIZE_RANGE, DEFAULT_VIEW_SETTINGS, applyViewSettings, flushViewSettingsSave, clampNumber });

    }
  })();
