import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanvasSession,
  verifyCanvasLoginSecret,
  verifyCanvasSession,
} from "../src/server/canvas/canvas-auth.ts";

test("canvas sessions are signed, expire, and reject tampering", () => {
  const secret = "a-very-long-runtime-secret";
  const tabToken = "tab-token-for-one-browser-tab-1234567890";
  const issuedAt = 1_700_000_000_000;
  const session = createCanvasSession(secret, tabToken, issuedAt, 60_000);

  assert.equal(verifyCanvasSession(session, secret, tabToken, issuedAt + 59_000), true);
  assert.equal(verifyCanvasSession(session, secret, tabToken, issuedAt + 61_000), false);
  assert.equal(verifyCanvasSession(`${session}x`, secret, tabToken, issuedAt + 1_000), false);
  assert.equal(verifyCanvasSession(session, "different-secret", tabToken, issuedAt + 1_000), false);
  assert.equal(verifyCanvasSession(session, secret, "", issuedAt + 1_000), false);
  assert.equal(verifyCanvasSession(session, secret, "another-tab-token-12345678901234567890", issuedAt + 1_000), false);
});

test("canvas login secret uses the runtime token without client-side derivation", () => {
  const secret = "runtime-only-secret";

  assert.equal(verifyCanvasLoginSecret(secret, secret), true);
  assert.equal(verifyCanvasLoginSecret("wrong-secret", secret), false);
  assert.equal(verifyCanvasLoginSecret("", secret), false);
});
