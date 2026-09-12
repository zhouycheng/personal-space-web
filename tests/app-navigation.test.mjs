import assert from "node:assert/strict";
import test from "node:test";

import { NAV_ITEMS, normalizeAppPath, pageForPath, studioStateForPage, historyAction } from "../src/app/navigation.ts";

test("application navigation keeps route definitions in one boundary", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.path), ["/home", "/works", "/canvas", "/os"]);
  assert.equal(pageForPath("/"), "home");
  assert.equal(pageForPath("/os/"), "os");
  assert.equal(pageForPath("/canvas/"), "canvas");
  assert.equal(pageForPath("/missing"), "home");
  assert.equal(normalizeAppPath("/works///"), "/works");
});

test("URL alone determines direct-load and refresh state", () => {
  assert.equal(studioStateForPage(pageForPath("/home")), "room");
  assert.equal(studioStateForPage(pageForPath("/os")), "desktop");
  assert.equal(studioStateForPage(pageForPath("/canvas")), "canvas");
  assert.equal(studioStateForPage(pageForPath("/works")), "room");
});

test("return reuses the existing home entry without adding a child-home loop", () => {
  for (const child of ["works", "canvas", "os"]) {
    assert.equal(historyAction("home", child, null), "push");
    assert.equal(historyAction(child, "home", {justinPage:child,from:"home"}), "back");
    assert.equal(historyAction(child, "home", null), "replace");
    assert.equal(historyAction(child, "home", {justinPage:"other",from:"home"}), "replace");
    assert.equal(historyAction(child, child, null), "none");
  }
});
