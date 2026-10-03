/** World units: the existing desk is 3.5 units wide and stands at y=0. */
export const islandAppearance = {
  radiusX: 7.2,
  radiusZ: 6.3,
  centerZ: -0.55,
  seaLevel: -0.28,
  plateau: 0.62,
  shoreHarmonics: [[3, 0.065, 0.4], [5, 0.035, 1.2], [7, 0.018, -0.7], [11, 0.006, 1.8]],
  // Front beach (+Z) and eastern landing (+X), joined by broad continuous slopes.
  shoreExtensions: [[Math.PI / 2, 0.38, 0.72], [0, 0.08, 0.62]],
  sand: 0xe7d4aa,
  wetSand: 0x9a8967,
  shallowWater: 0x299c9b,
  deepWater: 0x104b69,
} as const;
