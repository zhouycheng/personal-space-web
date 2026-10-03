import type { BookReport, JournalManifest, JournalRegion, JournalIntent } from "./journal";
import type { OperationResult } from "./operation";
import type { RoomView, RoomViewAction } from "./studio";

export type DrawerId = "drawer-top" | "drawer-middle" | "drawer-bottom";
export type StudioTargets = { view: RoomView; lampOn: boolean; showDate: boolean; drawers: boolean[] };
export type SceneSnapshot = StudioTargets;
export type StudioLighting = {
  daylight: number;
  background: string;
  foreground: string;
  sky: number;
  sun: number;
  sunIntensity: number;
  ambientIntensity: number;
  lampIntensity: number;
  screenSpillIntensity: number;
  sunDirection: readonly [number, number, number];
  zenith: number;
  horizon: number;
  sunset: number;
};
export type SurfaceRect = { left: number; top: number; width: number; height: number };

export interface TransitionPort {
  moveToSurface(target: "computer" | "canvas", enter: boolean, duration: number, update: (progress: number, rect: SurfaceRect) => void): Promise<OperationResult>;
  moveJournal(enter: boolean, duration: number): Promise<OperationResult>;
  cancelTransition(): void;
}

export interface ScenePort extends TransitionPort {
  snapshot(): SceneSnapshot;
  restore(snapshot: SceneSnapshot): void;
  setPointerEnabled(value: boolean): void;
  setActive(value: boolean): void;
  setLighting(light: StudioLighting): void;
  setTime(date: Date): void;
  adjustView(action: RoomViewAction): void;
  spinChair(reducedMotion?: boolean): void;
  setLampEnabled(enabled: boolean): void;
  setClockMode(mode: "time" | "date"): void;
  setDrawerOpen(action: DrawerId, open: boolean): void;
  configureJournal(book: JournalManifest, index: number, onReport: (state: BookReport) => void, onRegion: (region: JournalRegion) => void, onIntent: (intent: JournalIntent) => void): void;
  setJournalInteractionEnabled(value: boolean): void;
  hideJournal(): void;
  prepareJournal(reading: boolean): void;
  journalAvailable(): boolean;
  openJournal(value: boolean, preserveView?: boolean): Promise<OperationResult>;
  journalReady(): Promise<OperationResult>;
  cancelJournalPrefetch(): void;
  resetJournal(): void;
  setJournalPage(index: number): void;
  turnJournal(direction: 1 | -1): void;
  zoomJournal(value: number): void;
  dispose(): void;
}
