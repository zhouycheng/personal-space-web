import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { createCanvasStore } from "../src/server/canvas/canvas-store.ts";

const run = promisify(execFile);

test("SQLite online backup produces a valid snapshot while the source remains open", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-backup-"));
  const source = path.join(root, "canvas.db");
  const snapshot = path.join(root, "snapshot.db");
  const store = createCanvasStore(source);
  store.seedIfEmpty({ version: 4, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

  await run("sqlite3", [source, `.backup '${snapshot}'`]);
  const { stdout } = await run("sqlite3", [snapshot, "PRAGMA integrity_check;"]);

  assert.equal(stdout.trim(), "ok");
  assert.equal(store.check().ok, true);
  store.close();
});
