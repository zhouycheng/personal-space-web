import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkBoundaries } from '../scripts/boundaries/graph.mjs';

async function fixture(files, check) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'justin-boundaries-'));
  try {
    for (const [name, code] of Object.entries({ 'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }), ...files })) {
      const file = path.join(root, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, code);
    }
    await check(await checkBoundaries(root));
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('multiline, side-effect, re-export and literal dynamic imports cannot bypass layers', async () => {
  for (const code of ['import {\n x\n} from "../presentation/ui/view";', 'import "../presentation/ui/view";', 'export {x} from "../presentation/ui/view";', 'const x = import("@/presentation/ui/view");']) {
    await fixture({ 'src/application/wrong.ts': code, 'src/presentation/ui/view.ts': 'export const x=1;' }, r => assert.ok(r.errors.some(e => e.includes('cannot import src/presentation/ui/view.ts')), r.errors.join('\n')));
  }
});
test('Astro SSR is allowed; client scripts and hydration cannot transitively reach fs', async () => {
  const server = { 'src/infrastructure/server/read.ts': 'import {readFile} from "node:fs/promises"; export {readFile};' };
  await fixture({ ...server, 'src/pages/index.astro': '---\nimport {readFile} from "../infrastructure/server/read";\nconst title="日记";\n---\n<p>中文</p><script>const label="你好";</script>' }, r => assert.deepEqual(r.errors, []));
  for (const page of ['<script>import "../presentation/ui/client";</script>', '---\nimport Client from "../presentation/ui/client";\n---\n<Client client:only="react" />']) {
    await fixture({ ...server, 'src/pages/index.astro': page, 'src/presentation/ui/client.ts': 'export {readFile as default} from "../../infrastructure/server/read";' }, r => assert.ok(r.errors.some(e => e.includes('Browser/server violation') && e.includes('client.ts')), r.errors.join('\n')));
  }
});
test('platform identifiers respect scope, comments, strings and property names', async () => {
  await fixture({ 'src/application/pure.ts': '// document.body\nconst x="localStorage"; export function f(document:{body:string}) { return document.body; } const o={window: 1};' }, r => assert.deepEqual(r.errors, []));
  await fixture({ 'src/application/impure.ts': 'document.title="bad"; globalThis.localStorage.clear();' }, r => assert.equal(r.errors.filter(e => e.includes('platform access')).length, 2));
});
test('runtime cycles and unknown dynamic loads fail; type-only cycles are harmless', async () => {
  await fixture({ 'src/application/a.ts': 'import "./b";', 'src/application/b.ts': 'import "./a";' }, r => assert.ok(r.errors.some(e => e.includes('Runtime cycle'))));
  await fixture({ 'src/contracts/a.ts': 'import type {B} from "./b"; export type A={b:B};', 'src/contracts/b.ts': 'import type {A} from "./a"; export type B={a:A};' }, r => assert.deepEqual(r.errors, []));
  await fixture({ 'src/app/a.ts': 'const name="./b"; import(name);' }, r => assert.ok(r.errors.some(e => e.includes('non-static'))));
});

test('infrastructure adapters cannot call application and imported types respect pure contracts', async () => {
  await fixture({ 'src/infrastructure/client/wrong.ts': 'import "../../application/a";', 'src/application/a.ts': 'export const a=1;' },
    r => assert.ok(r.errors.some(e => e.includes('src/infrastructure/client cannot import src/application/a.ts'))));
  await fixture({ 'src/contracts/wrong.ts': 'type X=import("../presentation/scene/a").X;', 'src/presentation/scene/a.ts': 'export type X=number;' },
    r => assert.ok(r.errors.some(e => e.includes('cannot import src/presentation/scene'))));
  await fixture({ 'src/contracts/a.ts': 'export {type B} from "./b"; export type A=number;', 'src/contracts/b.ts': 'export {type A} from "./a"; export type B=number;' }, r => assert.deepEqual(r.errors, []));
  await fixture({ 'src/application/a.ts': 'globalThis["document"].title="bad";' }, r => assert.ok(r.errors.some(e => e.includes('platform access'))));
  await fixture({ 'src/application/a.ts': 'function f(globalThis:{document:string}) { return globalThis.document; }' }, r => assert.deepEqual(r.errors, []));
});
