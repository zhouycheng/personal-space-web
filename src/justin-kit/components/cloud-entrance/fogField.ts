import type { RGB } from './timePalette';

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

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
    paint(width: number, height: number, progress: number, pixels: Uint8ClampedArray, color: RGB = [188, 193, 196]) {
      const p = smooth(progress), movement = smooth((progress - .06) / .88);
      const cover = 1 - smooth((progress - .04) / .23), fade = 1 - smooth((progress - .78) / .22);
      const aspect = width / height;
      const illumination = (color[0] * .2126 + color[1] * .7152 + color[2] * .0722) / 200;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const nx = x / Math.max(1, width - 1) * 2 - 1, ny = y / Math.max(1, height - 1) * 2 - 1;
        // Preserve wisps across aspect ratios without stretching the domain into square cells.
        const u = nx * Math.min(aspect, 2) * .17, v = ny * .39;
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
        const shade = ((density - .48) * 48 + (1 - alpha) * 9) * illumination;
        const index = (y * width + x) * 4;
        pixels[index] = color[0] + shade;
        pixels[index + 1] = color[1] + shade;
        pixels[index + 2] = color[2] + shade;
        pixels[index + 3] = Math.round(alpha * 255);
      }
    },
  };
}
