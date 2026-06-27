export type MineCanvasHandleSide = "top" | "right" | "bottom" | "left";

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasControlOffset = {
  dx: number;
  dy: number;
};

type ResolveCubicControlsOptions = {
  source: CanvasPoint;
  target: CanvasPoint;
  sourceHandle: MineCanvasHandleSide;
  targetHandle: MineCanvasHandleSide;
  sourceControl?: CanvasControlOffset;
  targetControl?: CanvasControlOffset;
};

const HANDLE_DIRECTIONS: Record<MineCanvasHandleSide, CanvasControlOffset> = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

function defaultControlOffset(side: MineCanvasHandleSide, distance: number): CanvasControlOffset {
  const direction = HANDLE_DIRECTIONS[side];
  const length = Math.min(180, Math.max(48, distance * 0.34));
  return {
    dx: Math.round(direction.dx * length),
    dy: Math.round(direction.dy * length),
  };
}

export function toControlOffset(endpoint: CanvasPoint, control: CanvasPoint): CanvasControlOffset {
  return {
    dx: Math.round(control.x - endpoint.x),
    dy: Math.round(control.y - endpoint.y),
  };
}

export function resolveCubicControls(options: ResolveCubicControlsOptions) {
  const distance = Math.hypot(options.target.x - options.source.x, options.target.y - options.source.y);
  const sourceOffset = options.sourceControl || defaultControlOffset(options.sourceHandle, distance);
  const targetOffset = options.targetControl || defaultControlOffset(options.targetHandle, distance);

  return {
    sourceControl: {
      x: options.source.x + sourceOffset.dx,
      y: options.source.y + sourceOffset.dy,
    },
    targetControl: {
      x: options.target.x + targetOffset.dx,
      y: options.target.y + targetOffset.dy,
    },
  };
}

export function inferHandlePair(source: CanvasPoint, target: CanvasPoint) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0
      ? { sourceHandle: "right" as const, targetHandle: "left" as const }
      : { sourceHandle: "left" as const, targetHandle: "right" as const };
  }

  return deltaY >= 0
    ? { sourceHandle: "bottom" as const, targetHandle: "top" as const }
    : { sourceHandle: "top" as const, targetHandle: "bottom" as const };
}
