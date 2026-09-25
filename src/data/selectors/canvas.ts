import type { MineCanvasDocument } from "../../contracts/canvas";

export function canvasContentIsValid(document: MineCanvasDocument): boolean {
  const ids = new Set(document.nodes.map(node => node.id));
  return ids.size === document.nodes.length && document.nodes.length > 0 &&
    document.edges.every(edge => ids.has(edge.source) && ids.has(edge.target));
}
