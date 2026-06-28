import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanvasSession,
  verifyCanvasLoginSecret,
  verifyCanvasSession,
} from "../src/server/canvas/canvas-auth.ts";

test("canvas sessions are signed, expire, and reject tampering", () => {
  const secret = "a-very-long-runtime-secret";
  const issuedAt = 1_700_000_000_000;
  const session = createCanvasSession(secret, issuedAt, 60_000);

  assert.equal(verifyCanvasSession(session, secret, issuedAt + 59_000), true);
  assert.equal(verifyCanvasSession(session, secret, issuedAt + 61_000), false);
  assert.equal(verifyCanvasSession(`${session}x`, secret, issuedAt + 1_000), false);
  assert.equal(verifyCanvasSession(session, "different-secret", issuedAt + 1_000), false);
});

test("canvas login secret uses the runtime token without client-side derivation", () => {
  const secret = "runtime-only-secret";

  assert.equal(verifyCanvasLoginSecret(secret, secret), true);
  assert.equal(verifyCanvasLoginSecret("wrong-secret", secret), false);
  assert.equal(verifyCanvasLoginSecret("", secret), false);
});
