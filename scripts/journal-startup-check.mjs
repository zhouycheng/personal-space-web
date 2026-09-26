import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { root } from "./journal/paths.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "justin-no-browser-"));
const controller = new AbortController();
let service;
const environment = { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", ASTRO_DEV_BACKGROUND: "1", PLAYWRIGHT_BROWSERS_PATH: path.join(directory, "empty-browsers") };

async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: directory, env: environment, stdio: "inherit", signal: controller.signal });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`No-browser command exited ${code}: ${args.join(" ")}`)));
  });
}
async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
async function request(url) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); if (response.ok) return response; lastError = new Error(`${response.status} ${url}`); }
    catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw lastError;
}
async function stop() {
  if (!service || service.exitCode !== null) return;
  const exited = new Promise(resolve => service.once("exit", resolve));
  service.kill("SIGTERM");
  await exited;
  service = undefined;
}
try {
  for (const name of ["src", "public", "scripts", "package.json", "package-lock.json", "astro.config.mjs", "tsconfig.json", ".node-version"]) {
    await cp(path.join(root, name), path.join(directory, name), { recursive: true, filter: file => !file.includes(`${path.sep}.building-`) });
  }
  await rm(path.join(directory, "src/generated"), { recursive: true, force: true });
  await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
  await mkdir(environment.PLAYWRIGHT_BROWSERS_PATH);
  const astro = path.join(root, "node_modules/astro/bin/astro.mjs");
  const port = await freePort();
  service = spawn(process.execPath, [astro, "dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: directory, env: environment, stdio: "inherit" });
  const html = await (await request(`http://127.0.0.1:${port}/journal`)).text();
  assert.match(html, /data-journal-manifest/);
  const prepared = JSON.parse(await readFile(path.join(directory, "src/generated/journal.json"), "utf8"));
  assert.ok(["ready", "empty"].includes(prepared.availability));
  if (prepared.pages.length) assert.equal((await request(`http://127.0.0.1:${port}${prepared.pages[0].image}`)).headers.get("content-type"), "image/webp");
  await stop();
  await run([astro, "build"]);
  await run([path.join(directory, "scripts/journal-verify.mjs"), "--dist"]);
  // Verify the standalone runner after removing source and generator access.
  await rm(path.join(directory, "src"), { recursive: true });
  await rm(path.join(directory, "scripts"), { recursive: true });
  await rm(path.join(directory, "public"), { recursive: true });
  service = spawn(process.execPath, ["dist/server/entry.mjs"], { cwd: directory, env: { ...environment, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) }, stdio: "inherit" });
  assert.equal((await request(`http://127.0.0.1:${port}/journal`)).status, 200);
  if (prepared.pages.length) assert.equal((await request(`http://127.0.0.1:${port}${prepared.pages[0].image}`)).status, 200);
  const health = await (await request(`http://127.0.0.1:${port}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.journal?.ok, true);
  console.log("No-browser startup verified: fresh generated module, development, ordinary build, standalone runner without source, scripts or public inputs");
} finally {
  await stop(); controller.abort();
  await rm(directory, { recursive: true, force: true });
}
