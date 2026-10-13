/** +Z is the open beach; +X is the landing shown below the workspace in the reference. */
export const islandLeisure = {
  campfire: { x: 0.25, z: 5.25, radius: 1.05 },
  game: { x: -3.12, z: 2.9, angle: -0.32 },
  dock: { start: 6.4, end: 11.0, z: 1.35, width: 1.35, deck: 0.12 },
  boat: { offsetFromEnd: .65, sideGap: .95 },
} as const;

export const campfireFuel = { stock: 12, capacity: 7, burnSeconds: 180, ignitionSeconds: 8, refillSeconds: 10 } as const;
export const campfireLogOrder = [0, 1, 4, 5, 2, 3, 6] as const;

const dock=islandLeisure.dock,rodZ=dock.z-dock.width*.5-.035;
export const fishingRodPoints = [
  [dock.end-.72,dock.deck+.18,rodZ],[dock.end-.18,dock.deck+.59,rodZ],
  [dock.end+.60,dock.deck+1,rodZ-.08],[dock.end+1.48,dock.deck+1.2,rodZ-.20],
  [dock.end+2.2,dock.deck+1.16,rodZ-.31],
] as const;
