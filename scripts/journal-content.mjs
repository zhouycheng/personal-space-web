import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import sanitize from "sanitize-html";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function journalSources(sourceDir) {
  const files = [];
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (file.endsWith(".md")) files.push(file);
    }
  }
  await scan(sourceDir);
  return files.sort();
}

export async function compileJournalContent(options = {}) {
  const sourceDir = options.sourceDir ?? path.join(root, "src/content/journal");
  const sources = await journalSources(sourceDir);
  const digest = createHash("sha256");
  digest.update(await readFile(fileURLToPath(import.meta.url)));
  digest.update(await readFile(path.join(root, "package-lock.json")));
  const articles = [];
  for (const file of sources) {
    const raw = await readFile(file, "utf8");
    digest.update(path.relative(sourceDir, file)).update(raw);
    const { data, content } = matter(raw);
    if (data.draft === true) continue;
    const slug = path.basename(file, ".md");
    if (!data.title || !data.pubDate || Number.isNaN(new Date(data.pubDate).valueOf())) throw new Error(`Invalid journal metadata: ${file}`);
    const html = sanitize(marked.parse(content), {
      allowedTags: [...sanitize.defaults.allowedTags, "img", "figure", "figcaption"],
      allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "title"], "*": ["id"] },
      allowedSchemes: ["https", "http", "mailto"],
    });
    articles.push({ slug, title: String(data.title), description: String(data.description ?? ""), date: new Date(data.pubDate).toISOString().slice(0, 10), html, start: 0, count: 0 });
  }
  articles.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  return { articles, sources, contentHash: digest.digest("hex").slice(0, 20) };
}

async function writeAtomic(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, file);
}

/** Ordinary builds publish readable HTML and reuse only a complete matching book. */
export async function prepareJournalContent(options = {}) {
  const outputDir = options.outputDir ?? path.join(root, "public/journal/generated");
  const manifestPath = options.manifestPath ?? path.join(root, "src/generated/journal.json");
  const compiled = await compileJournalContent(options);
  try {
    const cached = JSON.parse(await readFile(manifestPath, "utf8"));
    if (cached.contentHash === compiled.contentHash && cached.pages.length > 0) {
      for (const page of cached.pages) {
        await access(path.join(outputDir, path.basename(page.image)));
        await access(path.join(outputDir, path.basename(page.thumbnail)));
      }
      return cached;
    }
  } catch { /* Missing or incomplete book falls back to text. */ }
  const manifest = { version: 1, hash: compiled.contentHash, contentHash: compiled.contentHash, width: 420, height: 594, articles: compiled.articles, pages: [] };
  const json = JSON.stringify(manifest);
  await writeAtomic(manifestPath, json);
  await writeAtomic(path.join(outputDir, "manifest.json"), json);
  console.log(`Journal: ${compiled.articles.length} articles, text mode`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareJournalContent();
