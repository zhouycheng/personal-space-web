export const readingLimits = { yaw: 10 * Math.PI / 180, pitch: 16 * Math.PI / 180, minPitch: 4 * Math.PI / 180 };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function journalSingle(width: number, height: number) {
  return width - 80 < 680 || height - 160 < 480;
}
export function constrainReading(pitch: number, yaw: number) {
  return { pitch: clamp(pitch, readingLimits.minPitch, readingLimits.pitch), yaw: clamp(yaw, -readingLimits.yaw, readingLimits.yaw) };
}
