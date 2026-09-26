import type { MineCanvasDocument } from "../../contracts/canvas";

export function canvasContentIsValid(document: MineCanvasDocument): boolean {
  if (!document || document.version !== 4 || !Array.isArray(document.nodes) || !Array.isArray(document.edges)) return false;
  const point = (value: { x: number; y: number } | undefined) => value && Number.isFinite(value.x) && Number.isFinite(value.y);
  if (!point(document.viewport) || !Number.isFinite(document.viewport.zoom) || document.viewport.zoom <= 0) return false;
  const ids = new Set(document.nodes.map(node => node?.id));
  const edgeIds = new Set(document.edges.map(edge => edge?.id));
  return ids.size === document.nodes.length && document.nodes.length > 0 &&
    edgeIds.size === document.edges.length && (!document.centerNodeId || ids.has(document.centerNodeId)) &&
    document.nodes.every(node => node && typeof node.id === "string" && node.id.length > 0 && node.type === "mine" && point(node.position) &&
      node.data && ["text", "image", "quote", "link", "timeline", "monitor", "businesscard"].includes(node.data.kind) &&
      Number.isFinite(node.data.width) && node.data.width > 0 && Number.isFinite(node.data.height) && node.data.height > 0) &&
    document.edges.every(edge => edge && typeof edge.id === "string" && edge.id.length > 0 && ids.has(edge.source) && ids.has(edge.target));
}
