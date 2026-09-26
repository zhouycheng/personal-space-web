import { fileURLToPath } from 'node:url';
import { checkBoundaries } from './boundaries/graph.mjs';

const result = await checkBoundaries(fileURLToPath(new URL('../', import.meta.url)));
if (result.errors.length) {
  console.error(result.errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Import and environment boundaries passed (${result.files} source files, ${result.edges} dependencies)`);
