export type MineCanvasHeightMode = "auto" | "manual";
export type MineCanvasAutoHeightKind = "text" | "timeline" | "businesscard";

const CONTENT_PADDING_BY_KIND: Record<MineCanvasAutoHeightKind, number> = {
  text: 28,
  timeline: 36,
  businesscard: 28,
};

export function resolveMeasuredCardHeight(
  kind: MineCanvasAutoHeightKind,
  measuredContentHeight: number,
  measuredChromeHeight = 0,
) {
  return Math.ceil(measuredContentHeight + Math.max(CONTENT_PADDING_BY_KIND[kind], measuredChromeHeight));
}

export function resolveMeasuredHeight(
  mode: MineCanvasHeightMode,
  currentHeight: number,
  measuredHeight: number,
  minimumHeight: number,
) {
  const contentHeight = Math.max(minimumHeight, Math.ceil(measuredHeight));
  return mode === "manual" ? Math.max(currentHeight, contentHeight) : contentHeight;
}
