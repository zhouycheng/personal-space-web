import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getMacOsDesktopEntries,
  resolveDesktopContentDirectory,
} from "../src/justin-kit/components/macos-desktop/runtime/desktop-scanner.ts";

test("desktop content directory uses public in development and dist/client in production", () => {
  const cwd = "/app";

  assert.equal(
    resolveDesktopContentDirectory({ cwd, production: false, env: {} }),
    path.join(cwd, "public/os-desktop"),
  );
  assert.equal(
    resolveDesktopContentDirectory({ cwd, production: true, env: {} }),
    path.join(cwd, "dist/client/os-desktop"),
  );
});

test("desktop content directory honors an explicit runtime override", () => {
  assert.equal(
    resolveDesktopContentDirectory({
      cwd: "/app",
      production: true,
      env: { JUSTIN_OS_DESKTOP_DIR: "/content/desktop" },
    }),
    "/content/desktop",
  );
});

test("strict desktop scans reject missing and empty content roots", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-desktop-"));
  const empty = path.join(root, "empty");
  await mkdir(empty);

  await assert.rejects(
    getMacOsDesktopEntries({ desktopDir: path.join(root, "missing"), strict: true }),
    /Desktop content directory is missing/,
  );
  await assert.rejects(
    getMacOsDesktopEntries({ desktopDir: empty, strict: true }),
    /Desktop content directory is empty/,
  );
});

test("desktop scanner keeps recursive Chinese folders and supported files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "justinweb-desktop-"));
  const folder = path.join(root, "组件库");
  await mkdir(folder);
  await writeFile(path.join(folder, "示例.html"), "<!doctype html>");
  await writeFile(path.join(folder, "说明.md"), "# 说明");
  await writeFile(path.join(folder, "ignored.txt"), "ignored");

  const entries = await getMacOsDesktopEntries({ desktopDir: root, strict: true });

  assert.deepEqual(entries.map((entry) => entry.title), ["组件库"]);
  assert.deepEqual(entries[0].children?.map((entry) => entry.title), ["示例", "说明"]);
});
