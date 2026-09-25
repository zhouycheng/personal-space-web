import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareJournalContent } from "../scripts/journal-content.mjs";

test("journal text build compiles safely, reuses complete pages, and falls back when content changes", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "justin-journal-content-"));
  const sourceDir = path.join(base, "source");
  const outputDir = path.join(base, "images");
  const manifestPath = path.join(base, "manifest.json");
  const article = path.join(sourceDir, "stable-slug.md");
  try {
    await mkdir(sourceDir);
    await writeFile(article, "---\ntitle: Test\npubDate: 2026-09-25\n---\n\nHello <script>alert(1)</script> world.");
    const options = { sourceDir, outputDir, manifestPath };
    const text = await prepareJournalContent(options);
    assert.deepEqual(text.pages, []);
    assert.equal(text.articles[0].slug, "stable-slug");
    assert.match(text.articles[0].html, /Hello/);
    assert.doesNotMatch(text.articles[0].html, /<script>/);
    assert.deepEqual(JSON.parse(await readFile(manifestPath, "utf8")), text);

    const book = { ...text, pages: [{ image: "/journal/generated/full.webp", thumbnail: "/journal/generated/thumb.webp" }] };
    await writeFile(manifestPath, JSON.stringify(book));
    await writeFile(path.join(outputDir, "full.webp"), "full");
    await writeFile(path.join(outputDir, "thumb.webp"), "thumb");
    assert.deepEqual(await prepareJournalContent(options), book);

    await writeFile(article, "---\ntitle: Test\npubDate: 2026-09-25\n---\n\nUpdated body.");
    const changed = await prepareJournalContent(options);
    assert.notEqual(changed.contentHash, text.contentHash);
    assert.deepEqual(changed.pages, []);
    assert.match(changed.articles[0].html, /Updated body/);
    assert.equal(await readFile(path.join(outputDir, "full.webp"), "utf8"), "full");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
