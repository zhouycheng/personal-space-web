import assert from "node:assert/strict";
import test from "node:test";

import {
  inferHandlePair,
  resolveCubicControls,
} from "../src/presentation/interaction/canvas/mineCanvasGeometry.ts";

test("inferHandlePair chooses the nearest horizontal sides", () => {
  assert.deepEqual(
    inferHandlePair(
      { x: 100, y: 100 },
      { x: 420, y: 160 },
    ),
    { sourceHandle: "right", targetHandle: "left" },
  );
});

test("inferHandlePair chooses the nearest vertical sides", () => {
  assert.deepEqual(
    inferHandlePair(
      { x: 200, y: 420 },
      { x: 160, y: 80 },
    ),
    { sourceHandle: "top", targetHandle: "bottom" },
  );
});

test("resolveCubicControls keeps stored controls relative to moving endpoints", () => {
  assert.deepEqual(
    resolveCubicControls({
      source: { x: 160, y: 90 },
      target: { x: 520, y: 250 },
      sourceHandle: "right",
      targetHandle: "left",
      sourceControl: { dx: 80, dy: -20 },
      targetControl: { dx: -70, dy: 30 },
    }),
    {
      sourceControl: { x: 240, y: 70 },
      targetControl: { x: 450, y: 280 },
    },
  );
});
