import type { CampfireState, FirewoodResult } from '../../contracts/campfire.ts';
import { campfireFuel as fuel, campfireLogOrder } from '../../config/islandLeisure.ts';

export function campfireStatus(state: CampfireState) {
  const burning = state.logs.filter(age => age !== null && age < fuel.burnSeconds).length;
  const result: FirewoodResult = burning >= fuel.capacity ? 'full' : state.stock === 0 ? 'empty' : 'added';
  const label = result === 'full' ? '火塘已满，等待木柴烧完' : result === 'empty' ? '柴架已空，等待补充' : '点击添一根柴';
  return { burning, result, label, text: `木柴 ${state.stock}/${fuel.stock} · 燃烧 ${burning}/${fuel.capacity} · ${label}` };
}

export function campfireHeat(state: CampfireState) {
  return state.logs.reduce<number>((sum, age) => {
    if (age === null) return sum;
    const ignition = Math.min(1, age / fuel.ignitionSeconds);
    return sum + ignition * ignition * (3 - 2 * ignition) * Math.max(0, 1 - age / fuel.burnSeconds);
  }, 0) / fuel.capacity;
}

export function createCampfireController() {
  let state: CampfireState = { stock: fuel.stock, refillElapsed: 0,
    logs: Array.from({ length: fuel.capacity }, (_, i) => campfireLogOrder.slice(0, 3).some(index => index === i) ? fuel.ignitionSeconds : null) };
  let previous: number | undefined;
  function step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    const burning = state.logs.some(age => age !== null && age < fuel.burnSeconds), beforeStock = state.stock;
    state.logs = state.logs.map(age => age === null ? null : Math.min(fuel.burnSeconds, age + seconds));
    if (state.stock < fuel.stock) {
      state.refillElapsed += seconds;
      const count = Math.floor(state.refillElapsed / fuel.refillSeconds);
      state.stock = Math.min(fuel.stock, state.stock + count);
      state.refillElapsed = state.stock === fuel.stock ? 0 : state.refillElapsed % fuel.refillSeconds;
    }
    return burning || state.stock !== beforeStock;
  }
  return {
    snapshot(): CampfireState { return { ...state, logs: [...state.logs] }; },
    view() { return { ...campfireStatus(state), heat: campfireHeat(state) }; },
    restore(saved: CampfireState) {
      const bounded = (value: number, max: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
      state = { stock: Math.floor(bounded(saved.stock, fuel.stock, fuel.stock)), refillElapsed: bounded(saved.refillElapsed, fuel.refillSeconds),
        logs: Array.from({ length: fuel.capacity }, (_, i) => typeof saved.logs?.[i] === 'number' ? bounded(saved.logs[i]!, fuel.burnSeconds, fuel.burnSeconds) : null) };
      if (state.stock === fuel.stock) state.refillElapsed = 0;
      previous = undefined;
    },
    addFirewood(): FirewoodResult {
      const result = campfireStatus(state).result;
      if (result !== 'added') return result;
      const index = campfireLogOrder.find(i => state.logs[i] === null || state.logs[i]! >= fuel.burnSeconds)!;
      state.stock--; state.logs[index] = 0;
      return result;
    },
    step,
    tick(now: number, running: boolean) {
      if (!running) { previous = undefined; return false; }
      const changed = previous !== undefined && step(Math.max(0, now - previous) / 1000);
      previous = now;
      return changed;
    },
    pause() { previous = undefined; },
  };
}
