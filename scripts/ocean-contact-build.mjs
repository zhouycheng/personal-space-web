import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createRockContactData} from '../src/presentation/scene/studio/islandRocks.ts';

const data=createRockContactData();
const packed=gzipSync(Buffer.from(data.buffer),{level:9});
await writeFile(new URL('../src/content/scene/rock-sections.bin.gz',import.meta.url),packed);
console.log(`Rock sections: ${data.byteLength} bytes, ${packed.byteLength} bytes compressed`);
