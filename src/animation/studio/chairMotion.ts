export const CHAIR_TURN_MS = 2000;

export function chairTurn(elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / CHAIR_TURN_MS));
  // Finite impulse: quick acceleration followed by a longer friction-like coast.
  const progress = 1 - (1 - t) ** 4 * (1 + 4 * t);
  return { angle: progress * Math.PI * 2, done: t === 1 };
}
