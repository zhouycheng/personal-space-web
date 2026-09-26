import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { compileJournalContent, prepareJournalContent } from "../scripts/journal-content.mjs";
import { buildJournal } from "../scripts/journal-build.mjs";
import { acquireJournalLock, writeAtomic } from "../scripts/journal/atomic.mjs";
import { generationEnvironment, renderFingerprint, sha256 } from "../scripts/journal/fingerprint.mjs";
import { readCurrentPackage } from "../scripts/journal/package.mjs";
import { journalPaths } from "../scripts/journal/paths.mjs";
import { pageSize } from "../scripts/journal/paths.mjs";
import { inspectJournalPackage } from "../src/infrastructure/server/journalPackageHealth.ts";

async function fixture(t, withArticle = true) {
  const base = await mkdtemp(path.join(os.tmpdir(), "journal-package-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const paths = journalPaths({ sourceDir: path.join(base, "source"), assetsDir: path.join(base, "assets"), fontsDir: path.join(base, "fonts"), cssPath: path.join(base, "page.css"), outputDir: path.join(base, "output"), manifestPath: path.join(base, "runtime.json") });
  await mkdir(paths.sourceDir); await mkdir(paths.assetsDir); await mkdir(paths.fontsDir);
  await writeFile(paths.cssPath, "body { color: black }");
  if (withArticle) await writeFile(path.join(paths.sourceDir, "entry.md"), "---\ntitle: Entry\npubDate: 2026-09-25\n---\nPrivate full body.");
  return paths;
}

async function publishFixture(paths) {
  const compiled = await compileJournalContent(paths), environment = await generationEnvironment();
  const renderHash = await renderFingerprint(paths, compiled.contentHash, environment);
  const directory = path.join(paths.outputDir, renderHash), files = {};
  for (const [folder, width, height] of [["pages", pageSize.width * pageSize.scale, pageSize.height * pageSize.scale], ["thumbnails", pageSize.width, pageSize.height]]) {
    await mkdir(path.join(directory, folder), { recursive: true });
    const image = await sharp({ create: { width, height, channels: 3, background: "#faf5e9" } }).webp({ lossless: true }).toBuffer();
    await writeFile(path.join(directory, `${folder}/0.webp`), image);
    files[`${folder}/0.webp`] = { sha256: sha256(image), bytes: image.length, width, height };
  }
  const manifest = { version: 2, hash: renderHash, renderHash, contentHash: compiled.contentHash, width: 420, height: 594, availability: "ready", environment, files,
    articles: compiled.articles.map(({ html, ...article }) => ({ ...article, count: 1 })),
    pages: [{ index: 0, slug: "entry", image: `/journal/generated/${renderHash}/pages/0.webp`, thumbnail: `/journal/generated/${renderHash}/thumbnails/0.webp`, imageWidth: pageSize.width * pageSize.scale, imageHeight: pageSize.height * pageSize.scale, anchors: ["entry-anchor"], regions: [] }] };
  await replaceManifest(paths, manifest);
  return manifest;
}

async function replaceManifest(paths, manifest) {
  const json = JSON.stringify(manifest);
  await writeAtomic(path.join(paths.outputDir, manifest.renderHash, "manifest.json"), json);
  await writeAtomic(path.join(paths.outputDir, "current.json"), JSON.stringify({ version: 1, renderHash: manifest.renderHash, manifestSha256: sha256(json) }));
}

test("current pointer owns activation; runtime projection excludes generator and body data", async t => {
  const paths = await fixture(t), manifest = await publishFixture(paths);
  await writeFile(path.join(paths.outputDir, "manifest.json"), "broken compatibility copy");
  const runtime = await prepareJournalContent({ ...paths, strict: true });
  assert.equal(runtime.renderHash, manifest.renderHash);
  assert.equal(runtime.availability, "ready");
  assert.equal("environment" in runtime, false); assert.equal("files" in runtime, false);
  assert.doesNotMatch(JSON.stringify(runtime), /Private full body|"html"|"text"/);
  const portable = { ...manifest.environment, platform: "linux", arch: "arm64" };
  assert.match(await renderFingerprint(paths, manifest.contentHash, portable), /^[a-f0-9]{20}$/);
});

test("body, assets, fonts and layout changes invalidate the same fingerprint", async t => {
  const paths = await fixture(t), original = await publishFixture(paths);
  for (const file of [path.join(paths.assetsDir, "image.svg"), path.join(paths.fontsDir, "font.woff2"), paths.cssPath]) {
    const before = await readFile(file).catch(() => null);
    await writeFile(file, "changed input");
    assert.equal((await prepareJournalContent(paths)).availability, "outdated");
    await assert.rejects(prepareJournalContent({ ...paths, strict: true }), /outdated/);
    if (before) await writeFile(file, before); else await rm(file);
  }
  await writeFile(path.join(paths.sourceDir, "entry.md"), "---\ntitle: Entry changed\npubDate: 2026-09-25\n---\nNew body.");
  assert.equal((await prepareJournalContent(paths)).availability, "outdated");
  assert.equal((await readCurrentPackage(paths.outputDir)).renderHash, original.renderHash);
});

test("missing, truncated and invalid images cannot pass package verification", async t => {
  const paths = await fixture(t), manifest = await publishFixture(paths);
  const file = path.join(paths.outputDir, manifest.renderHash, "pages/0.webp");
  const bytes = await readFile(file);
  await rm(file);
  await assert.rejects(readCurrentPackage(paths.outputDir), /ENOENT/);
  const truncated = bytes.subarray(0, Math.floor(bytes.length / 2));
  await writeFile(file, truncated);
  manifest.files["pages/0.webp"] = { ...manifest.files["pages/0.webp"], sha256: sha256(truncated), bytes: truncated.length };
  await replaceManifest(paths, manifest);
  await assert.rejects(readCurrentPackage(paths.outputDir));
  assert.equal((await prepareJournalContent(paths)).availability, "error");
});

test("malformed mappings, traversal and body payloads are rejected", async t => {
  const paths = await fixture(t), manifest = await publishFixture(paths);
  for (const mutate of [m => m.pages[0].image = "/journal/generated/../secret", m => m.pages[0].index = 4, m => m.articles[0].count = 2, m => m.articles[0].html = "body", m => m.pages[0].text = "body", m => m.pages[0].regions.push({ kind: "link", href: "javascript:alert(1)", label: "bad", x: 0, y: 0, width: 4, height: 4 })]) {
    const invalid = structuredClone(manifest); mutate(invalid);
    await replaceManifest(paths, invalid);
    await assert.rejects(readCurrentPackage(paths.outputDir), /Invalid journal package/);
  }
});

test("empty content creates a valid package without a browser and force output is immutable", async t => {
  const paths = await fixture(t, false);
  const manifest = await buildJournal(paths);
  assert.equal(manifest.availability, "empty");
  assert.deepEqual(manifest.pages, []);
  assert.equal((await prepareJournalContent({ ...paths, strict: true })).availability, "empty");
  assert.equal((await buildJournal({ ...paths, force: true })).renderHash, manifest.renderHash);
  await writeFile(path.join(paths.outputDir, manifest.renderHash, "manifest.json"), "different bytes");
  await assert.rejects(buildJournal({ ...paths, force: true }), /immutable version/);
});

test("live generation is exclusive and only a dead owner's lock can be reclaimed", async t => {
  const paths = await fixture(t, false);
  const release = await acquireJournalLock(paths.outputDir);
  await assert.rejects(acquireJournalLock(paths.outputDir), /already running/);
  await release();
  await writeFile(path.join(paths.outputDir, ".generation.lock"), JSON.stringify({ pid: 2147483647, token: "dead" }));
  const recovered = await acquireJournalLock(paths.outputDir);
  await recovered();
  const results = await Promise.allSettled([acquireJournalLock(paths.outputDir), acquireJournalLock(paths.outputDir)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  for (const result of results) if (result.status === "fulfilled") await result.value();
});

test("source changes or cancellation before activation preserve the old version", async t => {
  const paths = await fixture(t, false);
  await buildJournal(paths);
  const before = await readFile(path.join(paths.outputDir, "current.json"), "utf8");
  await assert.rejects(buildJournal({ ...paths, force: true, beforeActivate: () => writeFile(path.join(paths.sourceDir, "new.md"), "---\ntitle: Changed\npubDate: 2026-09-26\n---\nNew") }), /source changed/);
  assert.equal(await readFile(path.join(paths.outputDir, "current.json"), "utf8"), before);
  await rm(path.join(paths.sourceDir, "new.md"));
  const controller = new AbortController();
  await assert.rejects(buildJournal({ ...paths, force: true, signal: controller.signal, beforeActivate: () => controller.abort(new Error("interrupted")) }), /interrupted/);
  assert.equal(await readFile(path.join(paths.outputDir, "current.json"), "utf8"), before);
  const release = await acquireJournalLock(paths.outputDir); await release();
});

test("production health verifies baked resources without generator dependencies", async t => {
  const paths = await fixture(t), manifest = await publishFixture(paths);
  const health = () => inspectJournalPackage({ directory: paths.outputDir, production: true, expected: manifest });
  assert.deepEqual(await health(), { ok: true, availability: "ready", renderHash: manifest.renderHash, articles: 1, pages: 1 });
  const outdated = await inspectJournalPackage({ directory: paths.outputDir, expected: { availability: "ready", renderHash: "0".repeat(20) } });
  assert.equal(outdated.availability, "outdated");
  await writeFile(path.join(paths.outputDir, manifest.renderHash, "pages/0.webp"), "corrupt");
  assert.equal((await health()).ok, false);
  assert.equal((await health()).availability, "error");
  await rm(path.join(paths.outputDir, "current.json"));
  assert.equal((await health()).availability, "missing");
});
