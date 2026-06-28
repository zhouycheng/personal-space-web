import assert from "node:assert/strict";
import test from "node:test";

import { NAV_ITEMS, normalizeAppPath, pageForPath } from "../src/app/navigation.ts";

test("application navigation keeps route definitions in one boundary", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.path), ["/home", "/works", "/os"]);
  assert.equal(pageForPath("/"), "home");
  assert.equal(pageForPath("/os/"), "os");
  assert.equal(pageForPath("/missing"), "home");
  assert.equal(normalizeAppPath("/works///"), "/works");
});
