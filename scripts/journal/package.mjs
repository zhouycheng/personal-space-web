import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { sha256, renderFingerprint } from "./fingerprint.mjs";
import { pageSize } from "./paths.mjs";

const hashPattern = /^[a-f0-9]{20}$/;
const fail = message => { throw new Error(`Invalid journal package: ${message}`); };
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const text = value => typeof value === "string";

export function runtimeManifest(manifest) {
  const { environment: _environment, files: _files, ...runtime } = manifest;
  return runtime;
}

export function validateManifest(manifest) {
  if (!manifest || manifest.version !== 2 || !hashPattern.test(manifest.renderHash) || manifest.hash !== manifest.renderHash || !hashPattern.test(manifest.contentHash)) fail("version or fingerprint");
  if (manifest.width !== pageSize.width || manifest.height !== pageSize.height) fail("page dimensions");
  if (!["ready", "empty"].includes(manifest.availability) || !Array.isArray(manifest.articles) || !Array.isArray(manifest.pages)) fail("availability or records");
  const environment = manifest.environment;
  if (!environment || ["node", "playwright", "browserRevision", "platform", "arch", "channel"].some(key => !text(environment[key]) || !environment[key])) fail("generator environment");
  if (!manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) fail("file checksums");
  const slugs = new Set();
  let next = 0;
  for (const article of manifest.articles) {
    if (!text(article.slug) || !article.slug || /[\\/\x00-\x1f]/.test(article.slug) || slugs.has(article.slug)) fail("duplicate or invalid slug");
    if (!text(article.title) || !article.title.trim() || !text(article.description) || !/^\d{4}-\d{2}-\d{2}$/.test(article.date) || new Date(article.date).toISOString().slice(0, 10) !== article.date) fail("article metadata");
    if (!integer(article.start) || !integer(article.count, 1) || article.start !== next || Object.hasOwn(article, "html")) fail("article range or browser HTML");
    slugs.add(article.slug); next += article.count;
  }
  if (next !== manifest.pages.length || (next === 0) !== (manifest.availability === "empty")) fail("page count or empty state");
  const expectedFiles = new Set();
  for (let index = 0; index < manifest.pages.length; index++) {
    const page = manifest.pages[index];
    const article = manifest.articles.find(entry => index >= entry.start && index < entry.start + entry.count);
    if (page.index !== index || page.slug !== article?.slug || Object.hasOwn(page, "text")) fail(`page ${index} mapping or browser text`);
    if (page.imageWidth !== pageSize.width * pageSize.scale || page.imageHeight !== pageSize.height * pageSize.scale) fail(`page ${index} texture dimensions`);
    if (!Array.isArray(page.anchors) || page.anchors.some(anchor => !text(anchor) || !anchor) || new Set(page.anchors).size !== page.anchors.length) fail(`page ${index} anchors`);
    if (!Array.isArray(page.regions)) fail(`page ${index} regions`);
    for (const region of page.regions) {
      if (!["image", "link"].includes(region.kind) || !text(region.label) || !text(region.href)) fail("region metadata");
      if (region.kind === "image" ? !/^\/journal\/assets\/[^?#]+$/.test(region.href) : !/^(https?:\/\/|mailto:|#|\/(?!\/))/.test(region.href)) fail("region URL");
      if (region.href.includes("..") || region.href.includes("\\")) fail("region traversal");
      if (![region.x, region.y, region.width, region.height].every(Number.isFinite) || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 || region.x + region.width > manifest.width + 1 || region.y + region.height > manifest.height + 1) fail("region bounds");
    }
    for (const [field, subdirectory] of [["image", "pages"], ["thumbnail", "thumbnails"]]) {
      const file = `${subdirectory}/${index}.webp`;
      if (page[field] !== `/journal/generated/${manifest.renderHash}/${file}`) fail(`page ${index} ${field} path`);
      expectedFiles.add(file);
      const record = manifest.files[file];
      const scale = field === "image" ? pageSize.scale : 1;
      if (!record || !/^[a-f0-9]{64}$/.test(record.sha256) || !integer(record.bytes, 1) || record.width !== pageSize.width * scale || record.height !== pageSize.height * scale) fail(`page ${index} checksum`);
    }
  }
  if (Object.keys(manifest.files).length !== expectedFiles.size || Object.keys(manifest.files).some(file => !expectedFiles.has(file))) fail("unexpected files");
  return manifest;
}

export async function verifyPackageDirectory(directory, manifest) {
  validateManifest(manifest);
  const canonicalRoot = await realpath(directory);
  for (const [file, record] of Object.entries(manifest.files)) {
    const target = await realpath(path.join(directory, file));
    if (!target.startsWith(canonicalRoot + path.sep)) fail("resource escapes package");
    const bytes = await readFile(target);
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) fail(`checksum: ${file}`);
    const decoded = await sharp(bytes, { failOn: "warning" }).raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== record.width || decoded.info.height !== record.height) fail(`decoded dimensions: ${file}`);
  }
  return manifest;
}

export async function readCurrentPackage(outputDir) {
  const pointer = JSON.parse(await readFile(path.join(outputDir, "current.json"), "utf8"));
  if (pointer.version !== 1 || !hashPattern.test(pointer.renderHash) || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) fail("activation pointer");
  const directory = path.join(outputDir, pointer.renderHash);
  if (!(await realpath(directory)).startsWith(await realpath(outputDir) + path.sep)) fail("version escapes output");
  const manifestBytes = await readFile(path.join(directory, "manifest.json"));
  if (sha256(manifestBytes) !== pointer.manifestSha256) fail("manifest checksum");
  const manifest = JSON.parse(manifestBytes);
  if (manifest.renderHash !== pointer.renderHash) fail("activation version");
  return verifyPackageDirectory(directory, manifest);
}

export async function verifyCurrentPackage(paths, compiled) {
  const manifest = await readCurrentPackage(paths.outputDir);
  if (manifest.contentHash !== compiled.contentHash || manifest.renderHash !== await renderFingerprint(paths, compiled.contentHash, manifest.environment)) {
    const error = new Error("Journal book is outdated; run npm run journal:build");
    error.code = "JOURNAL_OUTDATED";
    throw error;
  }
  return manifest;
}
