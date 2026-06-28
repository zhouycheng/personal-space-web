import assert from "node:assert/strict";
import test from "node:test";

import { createCanvasSaveQueue } from "../src/features/canvas/client/canvas-save-queue.ts";

test("save queue serializes writes and coalesces pending documents", async () => {
  const calls = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = createCanvasSaveQueue({
    initialRevision: 4,
    save: async (document, expectedRevision) => {
      calls.push({ document, expectedRevision });
      if (calls.length === 1) await firstGate;
      return { status: "saved", revision: expectedRevision + 1 };
    },
  });

  queue.enqueue({ title: "first" });
  queue.enqueue({ title: "second" });
  queue.enqueue({ title: "latest" });
  releaseFirst();
  await queue.flush();

  assert.deepEqual(calls, [
    { document: { title: "first" }, expectedRevision: 4 },
    { document: { title: "latest" }, expectedRevision: 5 },
  ]);
  assert.equal(queue.getRevision(), 6);
});

test("save queue stops on revision conflict and preserves the unsaved document", async () => {
  const queue = createCanvasSaveQueue({
    initialRevision: 2,
    save: async () => ({ status: "conflict", revision: 5 }),
  });

  queue.enqueue({ title: "local changes" });
  await queue.flush();

  assert.equal(queue.getStatus(), "conflict");
  assert.deepEqual(queue.getPendingDocument(), { title: "local changes" });
  assert.equal(queue.getRevision(), 5);
});
