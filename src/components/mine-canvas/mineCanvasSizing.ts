export type MineCanvasHeightMode = "auto" | "manual";

export function resolveMeasuredHeight(
  mode: MineCanvasHeightMode,
  currentHeight: number,
  measuredHeight: number,
  minimumHeight: number,
) {
  const contentHeight = Math.max(minimumHeight, Math.ceil(measuredHeight));
  return mode === "manual" ? Math.max(currentHeight, contentHeight) : contentHeight;
}
