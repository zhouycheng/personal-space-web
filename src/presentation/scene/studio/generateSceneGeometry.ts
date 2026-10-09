import { createIslandGeometry,createWaterGeometry } from './islandGeometry.ts';
import { createRockGeometry,createRockContactData,ROCK_CONTACT_BYTES } from './islandRocks.ts';
import { createVegetationGeometry } from './vegetationGeometry.ts';
import type { PreparedSceneGeometry } from './sceneGeometryData.ts';

/** Shared deterministic generation. A worker yields tasks; fallback yields browser paints. */
export async function generateSceneGeometry(checkpoint:()=>Promise<void>,timings:Record<string,number>={}):Promise<PreparedSceneGeometry> {
  // Load alongside the existing geometry work. An unavailable asset keeps the exact CPU fallback.
  const sections=fetch(new URL('../../../content/scene/rock-sections.bin.gz',import.meta.url),{signal:AbortSignal.timeout(3000)})
    .then(response=>{if(!response.ok||!response.body)throw Error('Rock sections unavailable');return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();})
    .then(bytes=>{if(bytes.byteLength!==ROCK_CONTACT_BYTES)throw Error('Invalid rock sections');return new Uint16Array(bytes);})
    .catch(()=>undefined);
  async function step<T>(name:string,create:()=>T) {await checkpoint();const start=performance.now();const value=create();timings[name]=performance.now()-start;return value;}
  const sand=await step('sandCpu',createIslandGeometry);
  const rocks=await step('rocksCpu',createRockGeometry);
  const vegetation=await step('vegetationCpu',createVegetationGeometry);
  const water=await step('waterCpu',createWaterGeometry);
  const rockSections=await sections??await step('rockSectionsCpu',createRockContactData);
  return {sand,rocks,vegetation,water,rockSections};
}
