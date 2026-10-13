export type FishingPhase = 'idle' | 'entering' | 'ready' | 'casting' | 'waiting' | 'nibble' | 'bite' | 'reeling' | 'caught' | 'missed' | 'releasing' | 'leaving';
export type FishingState = Readonly<{
  phase: FishingPhase;
  elapsed: number;
  waitSeconds: number;
  length: number;
  miss: 'early' | 'late';
}>;

export interface FishingPort {
  view(): FishingState;
  start(): void;
  interact(): void;
  exit(): void;
  reset(): void;
  tick(now: number, running: boolean): boolean;
  pause(): void;
}
