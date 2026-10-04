export type SpringState = { value: number; velocity: number };

/** Exact damped oscillator step for a held target; independent of display cadence. */
export function stepSpring(state: SpringState, target: number, seconds: number, frequency: number, damping: number) {
  const dt = Math.max(0, Math.min(.05, seconds));
  const omega = frequency * Math.PI * 2, decay = damping * omega;
  const wd = omega * Math.sqrt(1 - damping * damping);
  const x = state.value - target, b = (state.velocity + decay * x) / wd;
  const e = Math.exp(-decay * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt);
  state.value = target + e * (x * c + b * s);
  state.velocity = e * ((b * wd - decay * x) * c - (x * wd + decay * b) * s);
}
