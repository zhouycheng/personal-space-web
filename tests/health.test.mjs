import assert from "node:assert/strict";
import test from "node:test";

import { createHealthReport } from "../src/server/health.ts";

test("health report is ready only when desktop content and database are healthy", async () => {
  const ready = await createHealthReport({
    readDesktopEntries: async () => [{ id: "folder", kind: "folder" }],
    checkDatabase: () => ({ ok: true }),
  });
  const empty = await createHealthReport({
    readDesktopEntries: async () => [],
    checkDatabase: () => ({ ok: true }),
  });

  assert.equal(ready.ok, true);
  assert.equal(ready.desktopEntries, 1);
  assert.equal(empty.ok, false);
  assert.equal(empty.desktopEntries, 0);
});

test("health report captures dependency failures without throwing", async () => {
  const report = await createHealthReport({
    readDesktopEntries: async () => { throw new Error("missing desktop"); },
    checkDatabase: () => ({ ok: false }),
  });

  assert.equal(report.ok, false);
  assert.match(report.error, /missing desktop/);
});
