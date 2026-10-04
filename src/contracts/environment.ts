import type { StudioLighting } from './studioPorts';
export type Observer = { latitude: number; longitude: number };
export type RegionId = 'east' | 'west' | 'south' | 'north';
export type Observation = Observer & { source: 'region' | 'location'; region: RegionId; acquiredAt?: number };
export type RGB = readonly [number, number, number];
export type EnvironmentPalette = {
  background: RGB; foreground: RGB; mist: RGB; mistLight: RGB; mistShadow: RGB;
  cloud: RGB; titleShadow: RGB; progress: RGB; progressPending: RGB; focus: RGB;
};
export type DayPhase = 'night' | 'predawn' | 'dawn' | 'sunrise' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'twilight';
export type EnvironmentSnapshot = {
  timestamp: number; observer: Observer; phase: DayPhase; solarAltitude: number;
  lunarAltitude: number; moonFraction: number; lighting: StudioLighting; palette: EnvironmentPalette;
};
