import type { Positions } from '../../../infrastructure/client/canvasPositions';

/** Memory owned by the mounted loader, never written to browser storage. */
export type CanvasSession = {
  positions?: Positions;
  viewport?: { x: number; y: number; zoom: number };
};
