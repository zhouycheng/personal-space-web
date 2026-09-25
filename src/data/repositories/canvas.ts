import { mineCanvasSeed } from "../../content/canvas/published";
import type { MineCanvasDocument } from "../../contracts/canvas";

export function getPublishedCanvas(): MineCanvasDocument {
  return mineCanvasSeed;
}
