import type { RGB } from './timePalette';

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** A swept brush on the fog's small grid; repeated strokes renew rather than add opacity. */
export function createFogTrail() {
  let width = 0, height = 0, time = 0;
  let strength = new Float32Array(0), stamped = new Float64Array(0);
  const trail = {
    mask: new Float32Array(0), flowX: new Float32Array(0), flowY: new Float32Array(0),
    resize(w: number, h: number) {
      if (w === width && h === height) return;
      width = w; height = h; time = 0;
      strength = new Float32Array(w * h); stamped = new Float64Array(w * h);
      trail.mask = new Float32Array(w * h); trail.flowX = new Float32Array(w * h); trail.flowY = new Float32Array(w * h);
    },
    stroke(from: { x: number; y: number }, to: { x: number; y: number }, radius: number) {
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
      const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius));
      const right = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + radius));
      const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius));
      const bottom = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + radius));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        const along = length ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / (length * length))) : 0;
        const amount = smooth(1 - Math.hypot(x - from.x - along * dx, y - from.y - along * dy) / radius);
        const index = y * width + x;
        if (amount <= 0 || amount < strength[index] * (1 - smooth((time - stamped[index]) / 1600))) continue;
        strength[index] = amount; stamped[index] = time;
        trail.flowX[index] = length ? dx / length : 0; trail.flowY[index] = length ? dy / length : 0;
      }
    },
    advance(delta: number) {
      time += Math.max(0, delta);
      const attack = 1 - Math.exp(-delta / 80);
      let active = false;
      for (let i = 0; i < strength.length; i++) {
        const target = strength[i] * (1 - smooth((time - stamped[i]) / 1600));
        trail.mask[i] = target > trail.mask[i] ? trail.mask[i] + (target - trail.mask[i]) * attack : target;
        if (target > 0) active = true;
        else strength[i] = 0;
      }
      return active;
    },
    clear() { strength.fill(0); trail.mask.fill(0); trail.flowX.fill(0); trail.flowY.fill(0); time = 0; },
    dispose() { trail.resize(0, 0); },
  };
  return trail;
}

/** Numerical, domain-warped density only: no cloud sprites or surface normals. */
export function createFogField() {
  const size = 512, mask = size - 1;
  let seed = 137;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  let noise = new Float32Array(size * size);
  const grids = [4, 8, 16, 32, 64, 128, 256].map(side => ({
    side, values: Float32Array.from({ length: side * side }, random),
  }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let value = 0, weight = 1, total = 0;
    for (const { side, values } of grids) {
      const gx = x / size * side, gy = y / size * side;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const tx = smooth(gx - ix), ty = smooth(gy - iy);
      const a = values[iy * side + ix], b = values[iy * side + (ix + 1) % side];
      const c = values[((iy + 1) % side) * side + ix], d = values[((iy + 1) % side) * side + (ix + 1) % side];
      value += ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) * weight;
      total += weight; weight *= .56;
    }
    noise[y * size + x] = value / total;
  }
  function sample(x: number, y: number, values = noise) {
    const gx = x * size, gy = y * size, ix = Math.floor(gx), iy = Math.floor(gy);
    const tx = gx - ix, ty = gy - iy;
    const a = values[(iy & mask) * size + (ix & mask)], b = values[(iy & mask) * size + ((ix + 1) & mask)];
    const c = values[((iy + 1) & mask) * size + (ix & mask)], d = values[((iy + 1) & mask) * size + ((ix + 1) & mask)];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  // Bake the curl into a reusable scalar buffer; per-frame work is just sampling.
  const warped = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wx = sample(u + .31, v + .17) - .5, wy = sample(u + .73, v + .59) - .5;
    warped[y * size + x] = sample(u + wx * .24, v + wy * .32);
  }
  noise = warped;
  return {
    sample,
    dispose() { noise = new Float32Array(0); },
    paint(width: number, height: number, progress: number, pixels: Uint8ClampedArray, color: RGB = [188, 193, 196], trail?: ReturnType<typeof createFogTrail>) {
      const p = smooth(progress), movement = smooth((progress - .06) / .88);
      const cover = 1 - smooth((progress - .04) / .23), fade = 1 - smooth((progress - .78) / .22);
      const aspect = width / height;
      const illumination = (color[0] * .2126 + color[1] * .7152 + color[2] * .0722) / 200;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const cell = y * width + x, thinning = progress === 0 ? trail?.mask[cell] ?? 0 : 0;
        const nx = x / Math.max(1, width - 1) * 2 - 1, ny = y / Math.max(1, height - 1) * 2 - 1;
        // Preserve wisps across aspect ratios without stretching the domain into square cells.
        const u = nx * Math.min(aspect, 2) * .17 - (trail?.flowX[cell] ?? 0) * thinning * .035;
        const v = ny * .39 - (trail?.flowY[cell] ?? 0) * thinning * .035;
        const driftX = nx * movement * .065, driftY = ny * movement * .12;
        const a = sample(u - driftX + p * .045 + .23, v - driftY - p * .025 + .36);
        const b = sample(u * 1.43 - driftX - p * .03 + .61, v * 1.17 - driftY + p * .04 + .13);
        const c = sample(u * 2.1 - driftX + p * .07 + .08, v * 1.8 - driftY - p * .035 + .72);
        const density = a * .5 + b * .32 + c * .18;
        // Broad, irregular thinning instead of four detached volumes or a hard circular mask.
        const distance = Math.sqrt(nx * nx * .7 + ny * ny * .85);
        const opening = movement * 2.6 - .24;
        const layerA = smooth((distance - opening + (a - .5) * 1.7) / .55 + .5);
        const layerB = smooth((distance - opening + (b - .5) * 1.9 + .12) / .65 + .5);
        const layerC = smooth((distance - opening + (c - .5) * 2.1 - .1) / .5 + .5);
        const optical = layerA * smooth((a - .25) * 2.7) * 1.5
          + layerB * smooth((b - .28) * 3) + layerC * smooth((c - .3) * 3.2) * .65;
        const alpha = (cover + (1 - cover) * (1 - Math.exp(-optical * 2.4))) * fade;
        // Low-contrast transmitted light, without height-map highlights or dark ridges.
        const shade = ((density - .48) * 48 * (1 - thinning * .7) - thinning * 6 + (1 - alpha) * 9) * illumination;
        const index = (y * width + x) * 4;
        pixels[index] = color[0] + shade;
        pixels[index + 1] = color[1] + shade;
        pixels[index + 2] = color[2] + shade;
        pixels[index + 3] = Math.round(alpha * 255);
      }
    },
  };
}
