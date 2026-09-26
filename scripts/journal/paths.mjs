import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const pageSize = Object.freeze({ width: 420, height: 594, scale: 3 });

export function isMain(moduleUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(moduleUrl); }
  catch { return false; }
}

export function journalPaths(options = {}) {
  return {
    sourceDir: options.sourceDir ?? path.join(root, "src/content/journal"),
    outputDir: options.outputDir ?? path.join(root, "public/journal/generated"),
    manifestPath: options.manifestPath ?? path.join(root, "src/generated/journal.json"),
    assetsDir: options.assetsDir ?? path.join(root, "public/journal/assets"),
    fontsDir: options.fontsDir ?? path.join(root, "public/journal/fonts"),
    cssPath: options.cssPath ?? path.join(root, "scripts/journal-page.css"),
  };
}
