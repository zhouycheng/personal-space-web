export const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };

// Move close enough for the fixed surface to cover the view, with a small overscan.
export const surfaceDistance = (width: number, height: number, aspect: number, fov: number) =>
  Math.min(height, width/aspect)/(2*Math.tan(fov*Math.PI/360)*1.15);
export const surfaceOpacity = (progress: number) => smooth((progress-0.88)/0.12);

// A pointer selects a position, never an unbounded velocity; cap travel at 420px/s.
export function galleryStep(current: number, target: number, elapsed: number) {
  const dt = Math.max(0, Math.min(32, elapsed));
  const delta = (target-current)*(1-Math.exp(-dt/240));
  return current + Math.max(-0.42*dt, Math.min(0.42*dt, delta));
}
