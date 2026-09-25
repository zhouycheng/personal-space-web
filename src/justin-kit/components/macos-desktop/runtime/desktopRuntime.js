  import { createDesktopIconInteraction } from "./desktopIconInteraction.js";
  import { createDesktopIconLayout } from "./desktopIconLayout.js";
  import { createDesktopWindowController } from "./desktopWindowController.js";
  import { readViewSettings as loadViewSettings, saveViewSettings as persistViewSettings } from "./desktopPersistence.js";
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
      let viewSettings = readViewSettings();
      let iconMetrics = getIconMetrics();

      let desktopLayoutFrame = 0;
      let viewSettingsSaveTimer = 0;
      const iconLayout = createDesktopIconLayout({
        iconLayer, iconStateById, storageKey, getIconMetrics: () => iconMetrics, clamp,
      });
      const {
        getDesktopBounds, clampIconPosition, layoutDesktopIcons, applyIconPosition,
        resolveIconCollisions, saveIconPositions, getIconBox, boxesOverlap,
        arrangeDesktopIcons,
      } = iconLayout;
      const windows = createDesktopWindowController({
        entryById, iconStateById, windowLayer, getWindowViewport, clamp,
        displayControlsId: SYSTEM_DISPLAY_CONTROLS_ID,
        windowSizeStorageKey: WINDOW_SIZE_STORAGE_KEY,
        getViewSettings: () => viewSettings,
        iconSizeRange: ICON_SIZE_RANGE,
        labelSizeRange: LABEL_SIZE_RANGE,
        defaultViewSettings: DEFAULT_VIEW_SETTINGS,
        applyViewSettings, flushViewSettingsSave, clampNumber,
      });
      const iconInteraction = createDesktopIconInteraction({
        iconLayer, selectionBox, iconStateById, getIconMetrics: () => iconMetrics,
        getDesktopBounds, clamp, getIconBox, boxesOverlap, applyIconPosition,
        clampIconPosition, resolveIconCollisions, saveIconPositions,
        openWindow: windows.openWindow,
      });

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
        iconInteraction.bindDesktopIcon(iconElement, id);
      });

      iconInteraction.bindDesktopSelection();
      layoutDesktopIcons();
      windows.syncIconWindowState();

      window.addEventListener("resize", scheduleDesktopLayout);
      window.addEventListener("justin-os-desktop:clear-windows", windows.clearWindowState);
      window.addEventListener("justin-os-desktop:open-display-controls", windows.openDisplayControlsWindow);
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
          windows.layoutWindowsForViewport();
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



    }
  })();
