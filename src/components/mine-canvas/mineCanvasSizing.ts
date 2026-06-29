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
  outerScrollHeight = 0,
) {
  const contentHeight = measuredContentHeight + CONTENT_PADDING_BY_KIND[kind];
  if (kind !== "timeline" || outerScrollHeight <= 0) {
    return Math.ceil(contentHeight);
  }
  // Timeline cards have an overflowing outer card with padding, dots, and
  // connector lines.  Measuring the inner content plus a fixed offset can
  // undershoot when several items wrap, so prefer the card's own scrollHeight.
  return Math.ceil(Math.max(contentHeight, outerScrollHeight + 2));
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
