import type { Observer, RegionId } from '../contracts/environment';
export const observatories: Record<RegionId, Observer & { label: string }> = {
  east: { label: '东部 · 上海', latitude: 31.2304, longitude: 121.4737 },
  west: { label: '西部 · 乌鲁木齐', latitude: 43.8256, longitude: 87.6168 },
  south: { label: '南部 · 广州', latitude: 23.1291, longitude: 113.2644 },
  north: { label: '北部 · 北京', latitude: 39.9042, longitude: 116.4074 },
};
export function isRegion(value: unknown): value is RegionId {
  return typeof value === 'string' && Object.hasOwn(observatories, value);
}
export function validObserver(value: unknown): value is Observer {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as Observer;
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
