import { stepSpring } from './spring.ts';
export const CHAIR_ROCKER_RADIUS = 1.45;

export function createChairRocking() {
  const state = { value: 0, velocity: 0 };
  let moving = false;
  return {
    get moving() { return moving; },
    push() { state.velocity = Math.min(.68, state.velocity + .48); moving = true; },
    reset() { state.value = state.velocity = 0; moving = false; },
    step(seconds: number) {
      stepSpring(state, 0, seconds, .72, .24);
      if (Math.abs(state.value) < .00015 && Math.abs(state.velocity) < .0006) {
        state.value = state.velocity = 0; moving = false;
      }
      const angle = state.value;
      return { angle, y: CHAIR_ROCKER_RADIUS * (1 - Math.cos(angle)), z: CHAIR_ROCKER_RADIUS * (angle - Math.sin(angle)) };
    },
  };
}
