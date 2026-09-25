export function readViewSettings(key, iconRange, labelRange, defaults, clampNumber) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    return {
      iconSize: clampNumber(parsed.iconSize, iconRange, defaults.iconSize),
      labelSize: clampNumber(parsed.labelSize, labelRange, defaults.labelSize),
    };
  } catch {
    return { ...defaults };
  }
}

export function saveViewSettings(key, settings) {
  try {
    window.localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // Private browsing and storage policy must not disable the desktop.
  }
}

export function readIconPositions(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveIconPositions(key, states) {
  const positions = {};
  states.forEach((state, id) => {
    positions[id] = { left: Math.round(state.left), top: Math.round(state.top) };
  });
  try {
    window.localStorage.setItem(key, JSON.stringify(positions));
  } catch {
    // The current desktop session remains usable without storage.
  }
}
