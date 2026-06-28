import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCanvasDocument,
  parseCanvasWriteRequest,
} from "../src/features/canvas/domain/canvas-document.ts";

const legacyDocument = {
  version: 3,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

test("canvas documents migrate from version 3 to version 4", () => {
  assert.equal(normalizeCanvasDocument(legacyDocument).version, 4);
});

test("canvas write requests require a document and non-negative expected revision", () => {
  const parsed = parseCanvasWriteRequest({ document: legacyDocument, expectedRevision: 2 });
  assert.equal(parsed.document.version, 4);
  assert.equal(parsed.expectedRevision, 2);

  assert.throws(() => parseCanvasWriteRequest({ document: legacyDocument, expectedRevision: -1 }), /revision/);
  assert.throws(() => parseCanvasWriteRequest({ document: { nodes: [] }, expectedRevision: 0 }), /document/);
});
