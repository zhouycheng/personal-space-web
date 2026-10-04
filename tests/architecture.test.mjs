import test from "node:test";
import assert from "node:assert/strict";
import { selectStudioFiles } from "../src/data/selectors/studioFiles.ts";
import { selectPortfolioProjects } from "../src/data/selectors/portfolio.ts";
import { createStudioClientStore } from "../src/data/stores/studioClient.ts";
import { resolveStudioIntent, studioTargetsForIntent } from "../src/application/studio/resolveIntent.ts";

test("one content repository feeds the room files and portfolio without presentation imports", () => {
  const repository = {
    projects: () => [{ id: "new-work", title: "New Work", summary: "Changed content", tags: ["New"], links: [{ kind: "github", href: "/source", label: "Source" }] }],
    resume: () => ({ name: "Example", summary: "Resume summary", role: "Developer", sections: [] }),
    studioFiles: () => [{ id: "new-work", kind: "project", source: "new-work" }, { id: "resume", kind: "resume" }],
  };
  const files = selectStudioFiles(repository);
  const portfolio = selectPortfolioProjects(repository);
  assert.deepEqual(files.map(file => file.title), ["New Work", "Example简历"]);
  assert.equal(portfolio[0].title, files[0].title);
  assert.deepEqual(portfolio[0].primaryLinks.map(link => link.href), ["/source"]);
});

test("client stores are isolated per mounted shell and retain URL as the initial page", () => {
  const a = createStudioClientStore("home", "room");
  const b = createStudioClientStore("canvas", "canvas");
  a.page = "os";
  a.state = "entering";
  assert.equal(a.$page.get(), "os");
  assert.equal(a.$state.get(), "entering");
  assert.equal(b.page, "canvas");
  assert.equal(b.state, "canvas");
});

test("scene and HTML controls produce the same user intent command", () => {
  assert.deepEqual(resolveStudioIntent("computer"), { kind: "navigate", page: "os" });
  assert.deepEqual(resolveStudioIntent("diary"), { kind: "navigate", page: "journal" });
  assert.deepEqual(resolveStudioIntent("lamp"), { kind: "scene", action: "lamp" });
});

test("application target rules preserve independent drawers and make journal preparation idempotent", () => {
  const initial = createStudioClientStore("home", "room").targets;
  const lamp = studioTargetsForIntent(initial, "lamp");
  assert.equal(lamp.lampOn, false);
  assert.equal(initial.lampOn, true);
  assert.equal(studioTargetsForIntent(lamp, "clock").showDate, true);
  const middle = studioTargetsForIntent(lamp, "drawer-middle");
  assert.deepEqual(middle.drawers, [false, true, false]);
  const journal = studioTargetsForIntent(middle, "diary");
  assert.deepEqual(journal.drawers, [false, true, false]);
  assert.equal(studioTargetsForIntent(journal, "diary"), journal);
  assert.equal(studioTargetsForIntent(journal, "zoom-in"), journal);
});
