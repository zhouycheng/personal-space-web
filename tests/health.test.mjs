import assert from "node:assert/strict";
import test from "node:test";

import { createHealthReport } from "../src/infrastructure/server/health.ts";
const healthyJournal = async () => ({ ok: true, availability: "ready", renderHash: "version", articles: 1, pages: 2 });

test("health report is ready only when desktop content and canvas are healthy", async () => {
  const ready = await createHealthReport({
    checkJournal: healthyJournal, production: true,
    readDesktopEntries: async () => [{ id: "folder", kind: "folder" }],
    checkCanvas: () => ({ ok: true }),
  });
  const empty = await createHealthReport({
    checkJournal: healthyJournal, production: true,
    readDesktopEntries: async () => [],
    checkCanvas: () => ({ ok: true }),
  });

  assert.equal(ready.ok, true);
  assert.equal(ready.desktopEntries, 1);
  assert.equal(empty.ok, false);
  assert.equal(empty.desktopEntries, 0);
});

test("health report captures dependency failures without throwing", async () => {
  const report = await createHealthReport({
    checkJournal: healthyJournal, production: true,
    readDesktopEntries: async () => { throw new Error("missing desktop"); },
    checkCanvas: () => ({ ok: false }),
  });

  assert.equal(report.ok, false);
  assert.match(report.error, /missing desktop/);
});

test("missing journal is degraded in development and unhealthy in production", async () => {
  const dependencies = {
    readDesktopEntries: async () => [{}], checkCanvas: () => ({ ok: true }),
    checkJournal: async () => ({ ok: false, availability: "missing", renderHash: null, articles: 0, pages: 0 }),
  };
  assert.equal((await createHealthReport({ ...dependencies, production: true })).ok, false);
  const development = await createHealthReport({ ...dependencies, production: false });
  assert.equal(development.ok, true);
  assert.equal(development.degraded, true);
  assert.equal(development.journal.availability, "missing");
});
