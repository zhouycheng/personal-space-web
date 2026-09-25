import { readIconPositions, saveIconPositions as persistIconPositions } from "./desktopPersistence.js";

const ICON_RIGHT_INSET = 12;
const ICON_COLUMN_GAP = 14;
const ICON_ROW_GAP = 10;
const ICON_SAFE_SIDE = 10;

export function createDesktopIconLayout({ iconLayer, iconStateById, storageKey, getIconMetrics, clamp }) {
  function getIconViewport() {
    const rect = iconLayer.getBoundingClientRect();
    return {
      width: rect.width || window.innerWidth,
      height: rect.height || window.innerHeight,
    };
  }

  function getDesktopBounds() {
    const viewport = getIconViewport();
    const styles = getComputedStyle(iconLayer);
    const safeTop = Number.parseFloat(styles.paddingTop) || 0;
    const safeBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const top = ICON_SAFE_SIDE + safeTop;
    const bottom = viewport.height - ICON_SAFE_SIDE - safeBottom;

    return {
      left: ICON_SAFE_SIDE,
      top,
      right: Math.max(ICON_SAFE_SIDE, viewport.width - ICON_SAFE_SIDE),
      bottom: Math.max(top + getIconMetrics().height, bottom),
    };
  }

  function clampIconPosition(position) {
    const bounds = getDesktopBounds();
    return {
      left: clamp(position.left, bounds.left, Math.max(bounds.left, bounds.right - getIconMetrics().width)),
      top: clamp(position.top, bounds.top, Math.max(bounds.top, bounds.bottom - getIconMetrics().height)),
    };
  }

  function getDefaultIconPositions() {
    const bounds = getDesktopBounds();
    const availableHeight = Math.max(getIconMetrics().height, bounds.bottom - bounds.top);
    const rowsPerColumn = Math.max(1, Math.floor((availableHeight + ICON_ROW_GAP) / (getIconMetrics().height + ICON_ROW_GAP)));
    const positions = new Map();

    [...iconStateById.values()].forEach((state, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      positions.set(state.id, clampIconPosition({
        left: bounds.right - ICON_RIGHT_INSET - getIconMetrics().width - column * (getIconMetrics().width + ICON_COLUMN_GAP),
        top: bounds.top + row * (getIconMetrics().height + ICON_ROW_GAP),
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


  function getIconBox(state) {
    return {
      left: state.left,
      top: state.top,
      right: state.left + getIconMetrics().width,
      bottom: state.top + getIconMetrics().height,
      centerX: state.left + getIconMetrics().width / 2,
      centerY: state.top + getIconMetrics().height / 2,
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

  return {
    getDesktopBounds, clampIconPosition, layoutDesktopIcons, applyIconPosition,
    resolveIconCollisions, saveIconPositions, getIconBox, boxesOverlap, arrangeDesktopIcons,
  };
}
