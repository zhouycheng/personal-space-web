import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { compileJournalContent, prepareJournalContent } from "../scripts/journal-content.mjs";

test("text compilation is a generation input, never a browser reading fallback", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "justin-journal-content-"));
  const sourceDir = path.join(base, "source"), outputDir = path.join(base, "images"), manifestPath = path.join(base, "runtime.json");
  try {
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, "stable-slug.md"), "---\ntitle: Test\npubDate: 2026-09-25\n---\n\nHello <script>alert(1)</script> world.");
    const options = { sourceDir, outputDir, manifestPath };
    const compiled = await compileJournalContent(options);
    assert.match(compiled.articles[0].html, /Hello/);
    assert.doesNotMatch(compiled.articles[0].html, /<script>/);
    const missing = await prepareJournalContent(options);
    assert.equal(missing.availability, "missing");
    assert.deepEqual(missing.pages, []);
    assert.equal(missing.articles[0].slug, "stable-slug");
    assert.equal(Object.hasOwn(missing.articles[0], "html"), false);
    assert.doesNotMatch(await readFile(manifestPath, "utf8"), /Hello|world/);
    await assert.rejects(prepareJournalContent({ ...options, strict: true }), /ENOENT/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("unreadable sources fail instead of becoming an empty diary, duplicate slugs fail", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "justin-journal-source-"));
  try {
    await assert.rejects(compileJournalContent({ sourceDir: path.join(base, "absent") }), /ENOENT/);
    const unavailable = await prepareJournalContent({ sourceDir: path.join(base, "absent"), outputDir: path.join(base, "output"), manifestPath: path.join(base, "runtime.json") });
    assert.equal(unavailable.availability, "error");
    await mkdir(path.join(base, "nested"));
    const text = "---\ntitle: Entry\npubDate: 2026-09-25\n---\nBody";
    await writeFile(path.join(base, "same.md"), text);
    await writeFile(path.join(base, "nested/same.md"), text);
    await assert.rejects(compileJournalContent({ sourceDir: base }), /Duplicate/);
  } finally { await rm(base, { recursive: true, force: true }); }
});
