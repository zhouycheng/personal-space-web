import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { root, pageSize } from "./paths.mjs";

export const sha256 = value => createHash("sha256").update(value).digest("hex");
export async function filesIn(directory, optional = false) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
    if (optional && error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(file));
    else if (entry.isFile()) files.push(file);
    else throw new Error(`Unsupported journal input: ${file}`);
  }
  return files.sort();
}

const relative = (base, file) => path.relative(base, file).split(path.sep).join("/");
async function versions(names) {
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  return Object.fromEntries(names.map(name => {
    const version = lock.packages[`node_modules/${name}`]?.version;
    if (!version) throw new Error(`Missing locked journal dependency: ${name}`);
    return [name, version];
  }));
}

export async function contentFingerprint(sourceDir, sources) {
  const records = [];
  for (const file of sources) records.push([relative(sourceDir, file), await readFile(file, "utf8")]);
  const compiler = await readFile(path.join(root, "scripts/journal-content.mjs"), "utf8");
  const fingerprint = await readFile(new URL("./fingerprint.mjs", import.meta.url), "utf8");
  // Stable paragraph anchors are assigned by the pagination compiler and are
  // part of content identity, not just raster identity.
  const anchorCompiler = await readFile(new URL("./paginate.mjs", import.meta.url), "utf8");
  const dependencies = await versions(["gray-matter", "marked", "sanitize-html"]);
  return { contentHash: sha256(JSON.stringify({ records, compiler, fingerprint, anchorCompiler, dependencies })).slice(0, 20), records };
}

export async function generationEnvironment(channel = "playwright-chromium") {
  if (channel !== "playwright-chromium") throw new Error("Journal generation requires the pinned Playwright Chromium; run npm run journal:setup");
  const dependencies = await versions(["playwright"]);
  const browsers = JSON.parse(await readFile(path.join(root, "node_modules/playwright-core/browsers.json"), "utf8"));
  return { node: process.versions.node, playwright: dependencies.playwright,
    browserRevision: browsers.browsers.find(browser => browser.name === "chromium").revision,
    platform: process.platform, arch: process.arch, channel };
}

export async function renderFingerprint(paths, contentHash, environment) {
  const expected = await generationEnvironment(environment.channel);
  if (environment.playwright !== expected.playwright || environment.browserRevision !== expected.browserRevision) {
    throw new Error("Journal generator version differs from the locked browser version");
  }
  const inputs = [];
  for (const [label, directory] of [["assets", paths.assetsDir], ["fonts", paths.fontsDir], ["generator", path.join(root, "scripts/journal")]]) {
    for (const file of await filesIn(directory, label === "assets")) inputs.push([`${label}/${relative(directory, file)}`, sha256(await readFile(file))]);
  }
  for (const [label, file] of [["page.css", paths.cssPath], ["build.mjs", path.join(root, "scripts/journal-build.mjs")]]) {
    inputs.push([label, sha256(await readFile(file))]);
  }
  const dependencies = await versions(["playwright", "pagedjs", "sharp"]);
  return sha256(JSON.stringify({ contentHash, inputs, dependencies, environment, pageSize })).slice(0, 20);
}
