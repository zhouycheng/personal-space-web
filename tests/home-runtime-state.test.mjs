import assert from "node:assert/strict";
import test from "node:test";

import {
  HOME_TRANSITION_STATE_KEY,
  TERMINAL_SPEED_FACTOR,
  parseHomeTransitionState,
  scaleTerminalDelay,
  serializeHomeTransitionState,
} from "../src/components/app/homeRuntimeState.mjs";

test("terminal delay scaling keeps the launch feeling but runs 20 percent faster", () => {
  assert.equal(TERMINAL_SPEED_FACTOR, 0.8);
  assert.equal(scaleTerminalDelay(100), 80);
  assert.equal(scaleTerminalDelay(72), 58);
  assert.equal(scaleTerminalDelay(1), 1);
});

test("collapsing transition snapshots are only written while progress is in between endpoints", () => {
  assert.equal(HOME_TRANSITION_STATE_KEY, "justin-home-transition-state");
  assert.equal(serializeHomeTransitionState("collapsing", 0), null);
  assert.equal(serializeHomeTransitionState("collapsing", 1), null);
  assert.equal(serializeHomeTransitionState("settled", 0.5), null);

  const snapshot = JSON.parse(serializeHomeTransitionState("collapsing", 0.42, 12345));

  assert.deepEqual(snapshot, {
    kind: "collapsing",
    progress: 0.42,
    updatedAt: 12345,
  });
});

test("saved home transition snapshots are parsed defensively", () => {
  assert.deepEqual(
    parseHomeTransitionState(JSON.stringify({ kind: "collapsing", progress: 0.6, updatedAt: 987 })),
    { kind: "collapsing", progress: 0.6, updatedAt: 987 },
  );

  assert.equal(parseHomeTransitionState(null), null);
  assert.equal(parseHomeTransitionState("{not-json"), null);
  assert.equal(parseHomeTransitionState(JSON.stringify({ kind: "opening", progress: 0.5, updatedAt: 1 })), null);
  assert.equal(parseHomeTransitionState(JSON.stringify({ kind: "collapsing", progress: 0, updatedAt: 1 })), null);
  assert.equal(parseHomeTransitionState(JSON.stringify({ kind: "collapsing", progress: 1, updatedAt: 1 })), null);
  assert.equal(parseHomeTransitionState(JSON.stringify({ kind: "collapsing", progress: Number.NaN, updatedAt: 1 })), null);
});
