type Rgb = {
  r: number;
  g: number;
  b: number;
};

type LandMass = {
  u: number;
  v: number;
  rx: number;
  ry: number;
  w: number;
};

export type DomePoint = {
  row: number;
  v: number;
  xNorm: number;
  t: number;
  jitterX: number;
  jitterY: number;
  base: number;
  glyphPick: number;
  wave: number;
};

export const STAR: Rgb = { r: 255, g: 230, b: 106 };
export const LAND: Rgb = { r: 255, g: 242, b: 142 };
export const OCEAN: Rgb = { r: 188, g: 185, b: 150 };

const LAND_MASSES: LandMass[] = [
  { u: 0.14, v: 0.36, rx: 0.054, ry: 0.074, w: 1.08 },
  { u: 0.36, v: 0.62, rx: 0.072, ry: 0.09, w: 1.12 },
  { u: 0.64, v: 0.31, rx: 0.058, ry: 0.072, w: 1.04 },
  { u: 0.86, v: 0.72, rx: 0.066, ry: 0.088, w: 1.1 },
];

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function wrap01(value: number) {
  return ((value % 1) + 1) % 1;
}

function circularDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function makeSeededRandom(initialSeed: number) {
  let seed = initialSeed;

  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function noise(u: number, v: number) {
  const a = Math.sin((u * 31.7 + v * 19.3) * Math.PI * 2);
  const b = Math.sin((u * 9.2 - v * 43.1) * Math.PI * 2);
  const c = Math.sin((u * 61.4 + v * 7.7) * Math.PI * 2);
  return (a * 0.5 + b * 0.32 + c * 0.18 + 1) * 0.5;
}

export function landValue(u: number, v: number) {
  let value = 0;

  LAND_MASSES.forEach((land) => {
    const dx = circularDistance(u, land.u) / land.rx;
    const dy = (v - land.v) / land.ry;
    const d = dx * dx + dy * dy;
    value += Math.max(0, 1 - d) * land.w;
  });

  return value + (noise(u, v) - 0.5) * 0.22;
}

export function mixRgb(from: Rgb, to: Rgb, amount: number) {
  return {
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  };
}

export function makeDomePoints(height: number): DomePoint[] {
  const points: DomePoint[] = [];
  const random = makeSeededRandom(32731);
  const rows = Math.round(clamp(height / 12.2, 40, 62));

  for (let row = 0; row < rows; row += 1) {
    const v = (row + 0.5) / rows;
    const domeWidth = Math.sqrt(Math.max(0, 1 - (1 - v) * (1 - v)));
    const topEase = clamp((v - 0.03) / 0.28, 0, 1);
    const count = Math.max(6, Math.round(8 + domeWidth * 78 * (0.34 + topEase * 0.66)));
    const rowShift = row % 2 ? 0.5 : 0;

    for (let i = 0; i < count; i += 1) {
      const t = (i + rowShift) / count;
      const xNorm = (t - 0.5) * 2;

      if (Math.abs(xNorm) > 0.995) continue;

      points.push({
        row,
        v,
        xNorm,
        t,
        jitterX: (random() - 0.5) * 0.1,
        jitterY: (random() - 0.5) * 0.13,
        base: 0.78 + random() * 0.22,
        glyphPick: random(),
        wave: random() * Math.PI * 2,
      });
    }
  }
  return points;
}
