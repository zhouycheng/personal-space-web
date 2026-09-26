import type { OperationResult } from "../contracts/operation";

/** Elapsed time advances only when the owner supplies an active frame. */
export function createActiveMotion() {
  let current: { elapsed: number; previous?: number; duration: number; sample: (value: number) => void; settle: (result: OperationResult) => void } | undefined;
  return {
    get running() { return Boolean(current); },
    start(duration: number, sample: (progress: number) => void): Promise<OperationResult> {
      this.cancel("superseded");
      sample(duration <= 0 ? 1 : 0);
      if (duration <= 0) return Promise.resolve({ status: "completed", value: undefined });
      return new Promise(resolve => { current = { elapsed: 0, duration, sample, settle: resolve }; });
    },
    tick(now: number) {
      const motion = current;
      if (!motion) return false;
      if (motion.previous !== undefined) motion.elapsed += Math.max(0, now - motion.previous);
      motion.previous = now;
      motion.sample(Math.min(1, motion.elapsed / motion.duration));
      if (motion.elapsed >= motion.duration && current === motion) {
        current = undefined;
        motion.settle({ status: "completed", value: undefined });
      }
      return Boolean(current);
    },
    pause() { if (current) current.previous = undefined; },
    cancel(reason = "cancelled") {
      const motion = current;
      current = undefined;
      motion?.settle({ status: "cancelled", reason });
    },
  };
}
