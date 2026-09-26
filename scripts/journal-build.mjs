import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileJournalContent } from "./journal-content.mjs";
import { isMain, journalPaths, pageSize } from "./journal/paths.mjs";
import { generationEnvironment, renderFingerprint, sha256 } from "./journal/fingerprint.mjs";
import { acquireJournalLock, writeAtomic } from "./journal/atomic.mjs";
import { readCurrentPackage, runtimeManifest, verifyPackageDirectory } from "./journal/package.mjs";

export async function buildJournal(options = {}) {
  const paths = journalPaths(options);
  const release = await acquireJournalLock(paths.outputDir);
  let temporary;
  try {
    options.signal?.throwIfAborted();
    const compiled = await compileJournalContent(paths);
    const environment = await generationEnvironment(options.channel);
    const renderHash = await renderFingerprint(paths, compiled.contentHash, environment);
    if (!options.force) {
      try {
        const cached = await readCurrentPackage(paths.outputDir);
        if (cached.renderHash === renderHash) {
          await writeAtomic(path.join(paths.outputDir, "manifest.json"), JSON.stringify(runtimeManifest(cached)));
          await writeAtomic(paths.manifestPath, JSON.stringify(runtimeManifest(cached)));
          console.log(`Journal: ${cached.pages.length} validated cached pages`);
          return cached;
        }
      } catch { /* An incomplete active package may be repaired by a full generation. */ }
    }
    temporary = await mkdtemp(path.join(paths.outputDir, ".building-"));
    const directory = path.join(temporary, "package");
    await mkdir(path.join(directory, "pages"), { recursive: true });
    await mkdir(path.join(directory, "thumbnails"));
    const inputs = path.join(temporary, "inputs");
    await mkdir(inputs);
    const frozen = { ...paths, assetsDir: path.join(inputs, "assets"), fontsDir: path.join(inputs, "fonts"), cssPath: path.join(inputs, "page.css") };
    await cp(paths.assetsDir, frozen.assetsDir, { recursive: true }).catch(async error => {
      if (error.code !== "ENOENT") throw error;
      await mkdir(frozen.assetsDir, { recursive: true });
    });
    await cp(paths.fontsDir, frozen.fontsDir, { recursive: true });
    await cp(paths.cssPath, frozen.cssPath);
    if (renderHash !== await renderFingerprint(frozen, compiled.contentHash, environment)) {
      throw new Error("Journal inputs changed while the generation snapshot was copied");
    }
    let result = { pages: [], files: {}, diagnostics: [] };
    if (compiled.articles.length) {
      const { paginateJournal } = await import("./journal/paginate.mjs");
      result = await paginateJournal({ articles: compiled.articles, renderHash, paths: frozen, directory, signal: options.signal });
    }
    const manifest = { version: 2, hash: renderHash, renderHash, contentHash: compiled.contentHash, width: pageSize.width, height: pageSize.height,
      availability: compiled.articles.length ? "ready" : "empty", environment,
      articles: compiled.articles.map(({ html: _html, ...article }) => article), pages: result.pages, files: result.files };
    const json = JSON.stringify(manifest);
    await writeFile(path.join(directory, "manifest.json"), json);
    await verifyPackageDirectory(directory, manifest);
    if (options.beforeActivate) await options.beforeActivate(manifest);
    options.signal?.throwIfAborted();
    const currentInput = await compileJournalContent(paths);
    if (currentInput.contentHash !== compiled.contentHash || renderHash !== await renderFingerprint(paths, currentInput.contentHash, environment)) {
      throw new Error("Journal source changed during generation; previous package remains active");
    }
    const destination = path.join(paths.outputDir, renderHash);
    let existing;
    try { existing = await readFile(path.join(destination, "manifest.json"), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (existing !== undefined) {
      if (existing !== json) throw new Error("Non-deterministic journal output for an immutable version; existing package was preserved");
      await verifyPackageDirectory(destination, JSON.parse(existing));
    } else await rename(directory, destination);
    options.signal?.throwIfAborted();
    // This rename is the only activation point. Other manifests are disposable projections.
    await writeAtomic(path.join(paths.outputDir, "current.json"), JSON.stringify({ version: 1, renderHash, manifestSha256: sha256(json) }));
    await writeAtomic(path.join(paths.outputDir, "manifest.json"), JSON.stringify(runtimeManifest(manifest)));
    await writeAtomic(paths.manifestPath, JSON.stringify(runtimeManifest(manifest)));
    if (options.diagnosticsPath) await writeAtomic(options.diagnosticsPath, JSON.stringify(result.diagnostics));
    console.log(`Journal: ${manifest.articles.length} articles, ${manifest.pages.length} pages, ${renderHash}`);
    return manifest;
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    await release();
  }
}

if (isMain(import.meta.url)) {
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Journal generation interrupted"));
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  try { await buildJournal({ force: process.argv.includes("--force"), signal: controller.signal }); }
  finally { process.off("SIGINT", cancel); process.off("SIGTERM", cancel); }
}
