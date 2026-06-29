import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMeasuredCardHeight,
  resolveMeasuredHeight,
} from "../src/components/mine-canvas/mineCanvasSizing.ts";

test("auto height follows measured content in both directions", () => {
  assert.equal(resolveMeasuredHeight("auto", 420, 236, 150), 236);
  assert.equal(resolveMeasuredHeight("auto", 180, 340, 150), 340);
});

test("manual height is preserved until content needs more room", () => {
  assert.equal(resolveMeasuredHeight("manual", 420, 236, 150), 420);
  assert.equal(resolveMeasuredHeight("manual", 420, 510, 150), 510);
});

test("measured height never drops below the card minimum", () => {
  assert.equal(resolveMeasuredHeight("auto", 200, 48, 150), 150);
});

test("timeline height prefers the outer card scroll height", () => {
  assert.equal(resolveMeasuredCardHeight("timeline", 520, 610), 612);
  assert.equal(resolveMeasuredCardHeight("timeline", 520, 0), 556);
});
