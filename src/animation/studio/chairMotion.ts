export const CHAIR_TURN_MS = 3600;
export const CHAIR_ROCKER_RADIUS = 1.45;

/** Damped fore/aft rocking; the circular runners roll without sliding or sinking. */
export function chairTurn(elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / CHAIR_TURN_MS));
  const angle=t===0||t===1?0:.16*Math.sin(t*Math.PI*4.5)*(1-Math.exp(-t*28))*(1-t)**2;
  return { angle, y:CHAIR_ROCKER_RADIUS*(1-Math.cos(angle)), z:CHAIR_ROCKER_RADIUS*(angle-Math.sin(angle)), done:t===1 };
}
