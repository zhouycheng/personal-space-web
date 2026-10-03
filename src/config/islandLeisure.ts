/** +Z is the open beach; +X is the landing shown below the workspace in the reference. */
export const islandLeisure = {
  campfire: { x: 0.25, z: 5.25, radius: 1.05 },
  game: { x: -3.12, z: 2.9, angle: -0.32 },
  dock: { start: 6.4, end: 11.0, z: 1.35, width: 1.35, deck: 0.12 },
  boat: { offsetFromEnd: .65, sideGap: .95 },
} as const;
