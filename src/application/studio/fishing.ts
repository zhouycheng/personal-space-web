import type { FishingPhase, FishingPort, FishingState } from '../../contracts/fishing.ts';
import { fishingTiming } from '../../config/fishing.ts';

export function createFishingController(onChange: (state: FishingState) => void = () => {}, random = Math.random): FishingPort {
  let state: FishingState = { phase: 'idle', elapsed: 0, waitSeconds: 6, length: 24, miss: 'early' };
  let previous: number | undefined;
  function phase(value: FishingPhase) {
    state = { ...state, phase: value, elapsed: 0 };
    previous = undefined;
    onChange(state);
  }
  return {
    view: () => state,
    start() { if (state.phase === 'idle') phase('entering'); },
    interact() {
      if (state.phase === 'ready' || state.phase === 'missed') {
        state = { ...state, waitSeconds: 5 + random() * 4, length: 18 + Math.floor(random() * 21) };
        phase('casting');
      } else if (state.phase === 'waiting' || state.phase === 'nibble') {
        state = { ...state, miss: 'early' }; phase('missed');
      } else if (state.phase === 'bite') phase('reeling');
      else if (state.phase === 'caught') phase('releasing');
    },
    exit() { if (state.phase !== 'idle' && state.phase !== 'leaving') phase('leaving'); },
    reset() { if (state.phase !== 'idle') phase('idle'); previous = undefined; },
    pause() { previous = undefined; },
    tick(now, running) {
      if (!running || !Number.isFinite(now)) { previous = undefined; return false; }
      const duration = state.phase === 'waiting' ? state.waitSeconds : fishingTiming[state.phase as keyof typeof fishingTiming];
      if (duration === undefined) { previous = undefined; return false; }
      const seconds = previous === undefined ? 0 : Math.max(0, now - previous) / 1000;
      previous = now;
      state = { ...state, elapsed: Math.min(duration, state.elapsed + seconds) };
      if (state.elapsed < duration) return false;
      const next = { entering: 'ready', casting: 'waiting', waiting: 'nibble', nibble: 'bite', bite: 'missed', reeling: 'caught', releasing: 'ready', leaving: 'idle' } as const;
      if (state.phase === 'bite') state = { ...state, miss: 'late' };
      // Start each cue on a visible frame, so a slow frame cannot skip the bite window.
      phase(next[state.phase as keyof typeof next]);
      return true;
    },
  };
}
