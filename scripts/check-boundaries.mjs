import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "src");
const oldDirectories = ["components", "features", "server", "lib", "layouts", "styles", "assets", "playground"];
const errors = [];

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(absolute));
    else result.push(absolute);
  }
  return result;
}

const allFiles = await files(source);
for (const old of oldDirectories) {
  if (allFiles.some(file => file.startsWith(path.join(source, old) + path.sep))) errors.push(`Old production directory still contains files: src/${old}`);
}

function layer(relative) {
  if (relative.startsWith("src/presentation/")) return relative.split("/").slice(0, 3).join("/");
  if (relative.startsWith("src/data/")) return relative.split("/").slice(0, 3).join("/");
  return relative.split("/").slice(0, 2).join("/");
}

function targetPath(file, specifier) {
  if (specifier.startsWith("/src/")) return specifier.slice(1);
  if (specifier.startsWith("src/")) return specifier;
  if (specifier.startsWith("@/")) return "src/" + specifier.slice(2);
  if (specifier.startsWith(".")) return path.relative(root, path.resolve(path.dirname(file), specifier)).replaceAll(path.sep, "/");
  return null;
}

const allowed = {
  "src/contracts": ["src/contracts"],
  "src/content": ["src/content", "src/contracts"],
  "src/config": ["src/config", "src/contracts"],
  "src/data/repositories": ["src/data", "src/contracts", "src/content", "src/infrastructure"],
  "src/data/stores": ["src/data", "src/contracts", "src/justin-kit"],
  "src/data/selectors": ["src/data", "src/contracts", "src/config"],
  "src/application": ["src/application", "src/contracts", "src/data", "src/config"],
  "src/animation": ["src/animation", "src/contracts", "src/config"],
  "src/presentation/scene": ["src/presentation/scene", "src/presentation/interaction", "src/animation", "src/application", "src/contracts", "src/config"],
  "src/presentation/interaction": ["src/presentation/interaction", "src/contracts", "src/config"],
  "src/justin-kit": ["src/justin-kit"],
};

for (const file of allFiles) {
  if (!/\.(?:ts|tsx|astro|mjs|js)$/.test(file)) continue;
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const owner = layer(relative);
  const code = await readFile(file, "utf8");
  const imports = [...code.matchAll(/(?:\b(?:import|export)\b[^\n]*?\bfrom\s*|\bimport\s*\()\s*["']([^"']+)["']/g)].map(match => match[1]);
  for (const specifier of imports) {
    if (owner === "src/contracts" && /^(?:three|react|@xyflow\/react|astro)/.test(specifier)) errors.push(`${relative}: contracts cannot depend on ${specifier}`);
    const target = targetPath(file, specifier);
    if (!target?.startsWith("src/")) continue;
    const prefixes = allowed[owner];
    if (prefixes && !prefixes.some(prefix => target === prefix || target.startsWith(prefix + "/"))) errors.push(`${relative}: ${owner} cannot import ${target}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Import boundaries passed (${allFiles.length} source files)`);
}
