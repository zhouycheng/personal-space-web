export type CampfireState = { stock: number; refillElapsed: number; logs: (number | null)[] };
export type FirewoodResult = 'added' | 'empty' | 'full';

export type CampfirePlacement = { x: number; z: number; angle: number; order: number; variant: number };
export type CampfireLayout = {
  logs: (CampfirePlacement | null)[];
  charcoal: { x: number; z: number; angle: number }[];
};
export type CampfireView = { burning: number; result: FirewoodResult; label: string; text: string; heat: number };
export interface CampfirePort {
  snapshot(): CampfireState;
  restore(state: CampfireState): void;
  view(): CampfireView;
  addFirewood(): FirewoodResult;
  tick(now: number, running: boolean): boolean;
  pause(): void;
}
