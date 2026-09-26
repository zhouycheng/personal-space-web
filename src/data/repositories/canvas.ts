import { mineCanvasSeed } from "../../content/canvas/published";
import type { MineCanvasDocument } from "../../contracts/canvas";
import { canvasContentIsValid } from "../selectors/canvas";

if (!canvasContentIsValid(mineCanvasSeed)) throw new Error("Invalid published canvas records");

export function getPublishedCanvas(): MineCanvasDocument {
  return mineCanvasSeed;
}
