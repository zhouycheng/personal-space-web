import path from "node:path";
import { isMain, journalPaths, root } from "./journal/paths.mjs";
import { compileJournalContent } from "./journal-content.mjs";
import { readCurrentPackage, verifyCurrentPackage } from "./journal/package.mjs";

export async function verifyJournal(options = {}) {
  const paths = journalPaths(options);
  const manifest = options.dist
    ? await readCurrentPackage(options.outputDir ?? path.join(root, "dist/client/journal/generated"))
    : await verifyCurrentPackage(paths, await compileJournalContent(paths));
  console.log(`Journal verified: ${manifest.renderHash}, ${manifest.articles.length} articles, ${manifest.pages.length} pages (${options.dist ? "distribution" : "source"})`);
  return manifest;
}

if (isMain(import.meta.url)) {
  const index = process.argv.indexOf("--output");
  await verifyJournal({ dist: process.argv.includes("--dist"), ...(index >= 0 ? { outputDir: path.resolve(process.argv[index + 1]) } : {}) });
}
