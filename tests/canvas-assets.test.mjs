import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createCanvasAssetStore } from "../src/server/canvas/canvas-assets.ts";

test("canvas assets are content-addressed and immutable", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-assets-"));
  const store = createCanvasAssetStore(root);
  const bytes = new TextEncoder().encode("fake-png");

  const first = await store.write(bytes, "image/png");
  const second = await store.write(bytes, "image/png");

  assert.equal(first.id, second.id);
  assert.equal(first.url, `/api/canvas/assets/${first.id}`);
  assert.deepEqual(new Uint8Array(await readFile(first.path)), bytes);
  assert.equal((await store.read(first.id)).mimeType, "image/png");
});

test("canvas assets reject unsupported media and unsafe identifiers", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-assets-"));
  const store = createCanvasAssetStore(root);

  await assert.rejects(store.write(new Uint8Array([1]), "text/html"), /Unsupported/);
  await assert.rejects(store.read("../secret"), /Invalid asset/);
});
