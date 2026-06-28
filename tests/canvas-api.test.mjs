import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = await mkdtemp(path.join(tmpdir(), "justinweb-api-"));
process.env.CANVAS_DB_PATH = path.join(root, "canvas.db");
process.env.CANVAS_ASSET_DIR = path.join(root, "canvas-assets");
process.env.CANVAS_AUTH_TOKEN = "api-test-secret";

const canvasApi = await import("../src/pages/api/canvas.ts");
const sessionApi = await import("../src/pages/api/canvas/session.ts");
const revisionApi = await import("../src/pages/api/canvas/revisions.ts");
const assetApi = await import("../src/pages/api/canvas/assets.ts");
const assetReadApi = await import("../src/pages/api/canvas/assets/[id].ts");

test("canvas API loads version 4 without exposing placeholder data", async () => {
  const response = await canvasApi.GET();
  const snapshot = await response.json();

  assert.equal(response.status, 200);
  assert.equal(snapshot.document.version, 4);
  assert.ok(snapshot.document.nodes.length > 0);
  assert.equal(snapshot.revision >= 0, true);
});

test("canvas API creates an HttpOnly session and preserves stale revisions", async () => {
  const sessionResponse = await sessionApi.POST({
    request: new Request("http://localhost/api/canvas/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "api-test-secret" }),
    }),
  });
  const setCookie = sessionResponse.headers.get("Set-Cookie");
  const cookie = setCookie?.split(";")[0] || "";
  assert.match(setCookie || "", /HttpOnly/);

  const initial = await (await canvasApi.GET()).json();
  const document = structuredClone(initial.document);
  document.nodes[0].data.title = "immutable newer title";
  const savedResponse = await canvasApi.POST({
    request: new Request("http://localhost/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ document, expectedRevision: initial.revision }),
    }),
  });
  const saved = await savedResponse.json();
  assert.equal(savedResponse.status, 200);

  const conflictResponse = await canvasApi.POST({
    request: new Request("http://localhost/api/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ document: initial.document, expectedRevision: initial.revision }),
    }),
  });
  assert.equal(conflictResponse.status, 409);

  const historyResponse = await revisionApi.GET({
    request: new Request("http://localhost/api/canvas/revisions", { headers: { Cookie: cookie } }),
  });
  const history = await historyResponse.json();
  assert.deepEqual(history.revisions.slice(0, 2).map((item) => item.revision), [saved.revision, initial.revision]);
});

test("canvas asset API persists authenticated images at immutable URLs", async () => {
  const sessionResponse = await sessionApi.POST({
    request: new Request("http://localhost/api/canvas/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: "api-test-secret" }),
    }),
  });
  const cookie = sessionResponse.headers.get("Set-Cookie")?.split(";")[0] || "";
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" }));
  const uploadResponse = await assetApi.POST({
    request: new Request("http://localhost/api/canvas/assets", {
      method: "POST",
      headers: { Cookie: cookie },
      body: form,
    }),
  });
  const uploaded = await uploadResponse.json();
  const readResponse = await assetReadApi.GET({ params: { id: uploaded.id } });

  assert.equal(uploadResponse.status, 201);
  assert.equal(readResponse.status, 200);
  assert.deepEqual(new Uint8Array(await readResponse.arrayBuffer()), new Uint8Array([1, 2, 3]));
});
