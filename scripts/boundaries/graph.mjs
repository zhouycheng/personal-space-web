import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import { parseDocument, parseCode } from './parse.mjs';
import { allowed, inside, isServerFile, layer, oldDirectories, pureLayers } from './rules.mjs';

const extensions = ['.ts', '.tsx', '.js', '.mjs', '.astro', '.json', '.css'];
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(directory, e.name)) : [path.join(directory, e.name)]))).flat();
}

export async function checkBoundaries(root) {
  const all = [...await walk(path.join(root, 'src')), ...await walk(path.join(root, 'public'))];
  const files = all.filter(file => /\.(?:[cm]?js|tsx?|astro|html)$/.test(file));
  const relative = file => path.relative(root, file).replaceAll(path.sep, '/');
  const existing = new Set(all), errors = [], units = new Map(), browserRoots = [], documents = new Set();
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  const options = config.error ? {} : ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  function resolve(file, specifier) {
    if (/^(https?:|data:|#)/.test(specifier)) return null;
    let target;
    if (specifier.startsWith('/src/')) target = path.join(root, specifier.slice(1));
    else if (specifier.startsWith('/')) target = path.join(root, 'public', specifier);
    else if (specifier.startsWith('.')) target = path.resolve(path.dirname(file), specifier);
    else {
      const result = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (!result || result.isExternalLibraryImport) return null;
      target = result.resolvedFileName;
    }
    const candidates = [target, ...extensions.map(ext => target + ext), ...extensions.map(ext => path.join(target, `index${ext}`))];
    if (/\.[cm]?js$/.test(target)) candidates.push(target.replace(/\.[cm]?js$/, '.ts'));
    return candidates.find(candidate => existing.has(candidate)) ?? target;
  }
  for (const old of oldDirectories) if (all.some(file => inside(relative(file), `src/${old}`))) errors.push(`Old production directory: src/${old}`);
  for (const file of files) {
    const name = relative(file);
    try {
      const code = await readFile(file, 'utf8'), document = /\.(astro|html)$/.test(file);
      const parsed = document ? parseDocument(code, name) : { blocks: [{ suffix: '', browser: false, ...parseCode(code, name) }], errors: [] };
      if (document) documents.add(name);
      for (const error of parsed.errors) errors.push(`${name}: ${error}`);
      for (const block of parsed.blocks) {
        const id = name + block.suffix;
        units.set(id, { ...block, id, name, file, edges: [] });
        if (block.browser) browserRoots.push(id);
        for (const error of block.errors) errors.push(`${id}: ${error}`);
      }
    } catch (error) { errors.push(`${name}: parse failed: ${error.message}`); }
  }
  for (const unit of units.values()) {
    const owner = layer(unit.name);
    if (pureLayers.has(owner)) for (const a of unit.platform) errors.push(`${unit.id}:${a.line}: platform access ${a.name} in ${owner}`);
    for (const d of unit.dynamic) errors.push(`${unit.id}:${d.line}: non-static module load: ${d.text}`);
    for (const dep of unit.dependencies) {
      const external = dep.specifier.replace(/^node:/, '');
      if (pureLayers.has(owner) && (dep.specifier.startsWith('node:') || builtins.has(external))) errors.push(`${unit.id}:${dep.line}: platform module ${dep.specifier} in ${owner}`);
      if (owner === 'src/contracts' && /^(?:three|react(?:-dom)?|@xyflow\/react|astro)(?:\/|$)/.test(dep.specifier)) errors.push(`${unit.id}:${dep.line}: contracts cannot depend on ${dep.specifier}`);
      const target = resolve(unit.file, dep.specifier);
      if (!target) {
        if (!dep.typeOnly && (dep.specifier.startsWith('node:') || builtins.has(external))) unit.edges.push({ target: `node:${external}`, runtime: true });
        continue;
      }
      const name = relative(target);
      if (!existing.has(target)) { errors.push(`${unit.id}:${dep.line}: unresolved local import ${dep.specifier}`); continue; }
      if (name.startsWith('src/') && allowed[owner] && !allowed[owner].some(prefix => inside(name, prefix))) errors.push(`${unit.id}:${dep.line}: ${owner} cannot import ${name}`);
      unit.edges.push({ target: documents.has(name) ? `${name}#server` : name, runtime: !dep.typeOnly });
    }
  }
  for (const rootId of browserRoots) {
    const seen = new Set();
    function trace(id, trail) {
      if (seen.has(id)) return;
      seen.add(id);
      if (id.startsWith('node:') || isServerFile(id.split('#')[0])) { errors.push(`Browser/server violation: ${[...trail, id].join(' -> ')}`); return; }
      for (const edge of units.get(id)?.edges ?? []) if (edge.runtime) trace(edge.target, [...trail, id]);
    }
    trace(rootId, []);
  }
  const visited = new Set(), active = new Set();
  function cycles(id, trail) {
    if (active.has(id)) { errors.push(`Runtime cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' -> ')}`); return; }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    for (const edge of units.get(id)?.edges ?? []) if (edge.runtime) cycles(edge.target, [...trail, id]);
    active.delete(id);
  }
  for (const id of units.keys()) cycles(id, []);
  return { errors: [...new Set(errors)], files: files.length, edges: [...units.values()].reduce((n, u) => n + u.edges.length, 0) };
}
