export type { JournalPhase } from '../../contracts/journal';
export const readingLimits = { yaw: 25 * Math.PI / 180, pitch: 15 * Math.PI / 180 };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function journalSingle(width: number, height: number) {
  return width - 80 < 680 || height - 160 < 480;
}
export function constrainReading(pitch: number, yaw: number) {
  return { pitch: clamp(pitch, -readingLimits.pitch, readingLimits.pitch), yaw: clamp(yaw, -readingLimits.yaw, readingLimits.yaw) };
}
