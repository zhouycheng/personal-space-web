import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createCanvasStore } from "../src/server/canvas/canvas-store.ts";

function documentWithTitle(title) {
  return {
    version: 4,
    nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: { kind: "text", title } }],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

test("canvas store seeds once and exposes a revisioned snapshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-canvas-"));
  const store = createCanvasStore(path.join(root, "nested", "canvas.db"));

  const first = store.seedIfEmpty(documentWithTitle("seed"));
  const second = store.seedIfEmpty(documentWithTitle("other"));

  assert.equal(first.document.nodes[0].data.title, "seed");
  assert.equal(first.revision, 0);
  assert.deepEqual(second, first);
  assert.equal(store.check().ok, true);
  store.close();
});

test("canvas store rejects stale revisions without overwriting newer content", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-canvas-"));
  const store = createCanvasStore(path.join(root, "canvas.db"));
  store.seedIfEmpty(documentWithTitle("seed"));

  const saved = store.write(documentWithTitle("newer"), 0);
  const stale = store.write(documentWithTitle("stale"), 0);

  assert.equal(saved.status, "saved");
  assert.equal(saved.snapshot.revision, 1);
  assert.equal(stale.status, "conflict");
  assert.equal(stale.snapshot.document.nodes[0].data.title, "newer");
  assert.equal(store.read().revision, 1);

  const revisions = store.listRevisions();
  assert.deepEqual(revisions.map((item) => item.revision), [1, 0]);
  assert.equal(store.readRevision(0).document.nodes[0].data.title, "seed");
  assert.equal(store.readRevision(1).document.nodes[0].data.title, "newer");

  const restored = store.restoreRevision(0, 1);
  assert.equal(restored.status, "saved");
  assert.equal(restored.snapshot.revision, 2);
  assert.equal(restored.snapshot.document.nodes[0].data.title, "seed");
  assert.equal(store.readRevision(1).document.nodes[0].data.title, "newer");
  store.close();
});
