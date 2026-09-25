import type { BookReport, JournalManifest, JournalRegion } from "./journal";
import type { RoomView, RoomViewAction } from "./studio";

export type SceneSnapshot = { view: RoomView; lampOn: boolean; showDate: boolean; drawers: boolean[] };
export type StudioLighting = { daylight: number; background: string; foreground: string; sky: number; sun: number };
export type SurfaceRect = { left: number; top: number; width: number; height: number };

export interface TransitionPort {
  moveToSurface(target: "computer" | "canvas", enter: boolean, duration: number, update: (progress: number, rect: SurfaceRect) => void): Promise<void>;
  moveJournal(enter: boolean, duration: number): Promise<void>;
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
  toggleLamp(): boolean;
  toggleClock(): boolean;
  toggleDrawer(action: "drawer-top" | "drawer-middle" | "drawer-bottom"): boolean;
  configureJournal(book: JournalManifest, index: number, onReport: (state: BookReport) => void, onRegion: (region: JournalRegion) => void): void;
  hideJournal(): void;
  prepareJournal(reading: boolean): void;
  journalAvailable(): boolean;
  openJournal(value: boolean): Promise<void>;
  resetJournal(): void;
  setJournalPage(index: number): void;
  turnJournal(direction: 1 | -1): void;
  zoomJournal(value: number): void;
  retryJournal(): void;
  dispose(): void;
}
