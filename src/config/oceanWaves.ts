export const oceanWaves = [
  [7.3, .10, .28, .2], [4.8, .065, -.35, 2.1], [3.1, .04, .75, 4.2],
  [1.9, .02, -.7, 1.4], [1.15, .01, .12, 3.7],
] as const;
export const oceanSteepness = 0.6;

// Amplitude, angular speed, X/Z wave numbers, phase; shared by buoyancy and GLSL.
export const shoreWaves = [[.062, .78, .28, .19, 0], [.023, .47, -.17, .31, 1.7]] as const;
