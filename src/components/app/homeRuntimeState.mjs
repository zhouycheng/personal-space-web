export const TERMINAL_SPEED_FACTOR = 0.8;
export const HOME_TRANSITION_STATE_KEY = "justin-home-transition-state";

export function scaleTerminalDelay(ms) {
  const delay = Number(ms);
  if (!Number.isFinite(delay) || delay <= 0) return 0;
  return Math.max(1, Math.round(delay * TERMINAL_SPEED_FACTOR));
}

export function serializeHomeTransitionState(kind, progress, updatedAt = Date.now()) {
  const normalizedProgress = Number(progress);
  if (kind !== "collapsing" || !Number.isFinite(normalizedProgress)) return null;
  if (normalizedProgress <= 0 || normalizedProgress >= 1) return null;

  const normalizedUpdatedAt = Number(updatedAt);

  return JSON.stringify({
    kind,
    progress: normalizedProgress,
    updatedAt: Number.isFinite(normalizedUpdatedAt) ? normalizedUpdatedAt : Date.now(),
  });
}

export function parseHomeTransitionState(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;

  try {
    const value = JSON.parse(raw);
    if (!value || value.kind !== "collapsing") return null;

    const progress = Number(value.progress);
    if (!Number.isFinite(progress) || progress <= 0 || progress >= 1) return null;

    const updatedAt = Number(value.updatedAt);
    if (!Number.isFinite(updatedAt)) return null;

    return {
      kind: "collapsing",
      progress,
      updatedAt,
    };
  } catch {
    return null;
  }
}
