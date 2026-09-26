/** Shared resource and interaction limits; no device-dependent quality reduction. */
export const journalRuntime = {
  requestTimeoutMs: 15_000,
  prepareTimeoutMs: 30_000,
  recoveryTimeoutMs: 15_000,
  animationSlackMs: 2_000,
  coverDurationMs: 750,
  pageDurationMs: 650,
  drawerDurationMs: 420,
  networkConcurrency: 3,
  decodeConcurrency: 2,
  maxPages: 4,
  decodedBytes: 48 * 1024 * 1024,
  textureBytes: 64 * 1024 * 1024,
} as const;
