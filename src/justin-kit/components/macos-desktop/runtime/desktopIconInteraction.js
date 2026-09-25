const DRAG_THRESHOLD = 4;
const SELECTION_HOLD_MS = 120;
const SELECTION_DRAG_THRESHOLD = 6;

export function createDesktopIconInteraction({
  iconLayer, selectionBox, iconStateById, getIconMetrics, getDesktopBounds,
  clamp, getIconBox, boxesOverlap, applyIconPosition, clampIconPosition,
  resolveIconCollisions, saveIconPositions, openWindow,
}) {
  const selectedIconIds = new Set();
  let selectionFrame = 0;
  let selectionPendingPoint = null;
  let iconDragFrame = 0;
  let iconDragCommit = null;

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
        right: getIconMetrics().width,
        bottom: getIconMetrics().height,
      };
    }

    return states.reduce((bounds, state) => {
      const position = positions?.get(state.id) || state;
      return {
        left: Math.min(bounds.left, position.left),
        top: Math.min(bounds.top, position.top),
        right: Math.max(bounds.right, position.left + getIconMetrics().width),
        bottom: Math.max(bounds.bottom, position.top + getIconMetrics().height),
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

  return { bindDesktopIcon, bindDesktopSelection };
}
