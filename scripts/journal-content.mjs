import { readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sanitize from "sanitize-html";
import { contentFingerprint } from "./journal/fingerprint.mjs";
import { isMain, journalPaths, pageSize } from "./journal/paths.mjs";
import { runtimeManifest, verifyCurrentPackage } from "./journal/package.mjs";
import { writeAtomic } from "./journal/atomic.mjs";

export async function journalSources(sourceDir) {
  const files = [];
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (entry.isFile() && file.endsWith(".md")) files.push(file);
      else if (entry.isSymbolicLink()) throw new Error(`Journal source symlinks are unsupported: ${file}`);
    }
  }
  await scan(sourceDir);
  return files.sort();
}

export async function compileJournalContent(options = {}) {
  const { sourceDir } = journalPaths(options);
  const sources = await journalSources(sourceDir);
  const { contentHash, records } = await contentFingerprint(sourceDir, sources);
  const articles = [], slugs = new Set();
  for (const [file, raw] of records) {
    const { data, content } = matter(raw);
    if (data.draft !== undefined && typeof data.draft !== "boolean") throw new Error(`Invalid journal draft flag: ${file}`);
    if (data.draft === true) continue;
    const slug = path.basename(file, ".md");
    if (!slug || slugs.has(slug)) throw new Error(`Duplicate or invalid journal slug: ${slug}`);
    slugs.add(slug);
    if (typeof data.title !== "string" || !data.title.trim() || (data.description !== undefined && typeof data.description !== "string") || !data.pubDate || Number.isNaN(new Date(data.pubDate).valueOf())) throw new Error(`Invalid journal metadata: ${file}`);
    const html = sanitize(marked.parse(content), {
      allowedTags: [...sanitize.defaults.allowedTags, "img", "figure", "figcaption"],
      allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "title"], "*": ["id"] },
      allowedSchemes: ["https", "http", "mailto"],
    });
    articles.push({ slug, title: String(data.title), description: String(data.description ?? ""), date: new Date(data.pubDate).toISOString().slice(0, 10), html, start: 0, count: 0 });
  }
  articles.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  return { articles, sources, contentHash };
}

/** Development keeps non-journal routes available; production never publishes stale pages. */
export async function prepareJournalContent(options = {}) {
  const paths = journalPaths(options);
  let compiled, manifest;
  try {
    compiled = await compileJournalContent(paths);
    manifest = runtimeManifest(await verifyCurrentPackage(paths, compiled));
  } catch (error) {
    if (options.strict) throw error;
    const availability = error.code === "JOURNAL_OUTDATED" ? "outdated" : error.code === "ENOENT" && compiled ? "missing" : "error";
    manifest = { version: 2, hash: "", renderHash: "", contentHash: compiled?.contentHash ?? "", width: pageSize.width, height: pageSize.height,
      availability, error: availability === "outdated" ? "日记内容已更新，书页需要重新生成。" : availability === "missing" ? "日记书页尚未生成。" : "日记书页暂时不可用，请重试或返回工作室。",
      articles: (compiled?.articles ?? []).map(({ html: _html, ...article }) => article), pages: [] };
    console.warn(`Journal ${availability}: ${error.message}`);
  }
  if (["ready", "empty"].includes(manifest.availability)) {
    await writeAtomic(path.join(paths.outputDir, "manifest.json"), JSON.stringify(manifest));
  }
  await writeAtomic(paths.manifestPath, JSON.stringify(manifest));
  return manifest;
}

if (isMain(import.meta.url)) await prepareJournalContent({ strict: process.argv.includes("--strict") });
