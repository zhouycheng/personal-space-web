import { createIslandGeometry,createWaterGeometry } from './islandGeometry.ts';
import { createRockGeometry } from './islandRocks.ts';
import { createVegetationGeometry } from './vegetationGeometry.ts';
import type { PreparedSceneGeometry } from './sceneGeometryData.ts';

/** Shared deterministic generation. A worker yields tasks; fallback yields browser paints. */
export async function generateSceneGeometry(checkpoint:()=>Promise<void>,timings:Record<string,number>={}):Promise<PreparedSceneGeometry> {
  async function step<T>(name:string,create:()=>T) {await checkpoint();const start=performance.now();const value=create();timings[name]=performance.now()-start;return value;}
  const sand=await step('sandCpu',createIslandGeometry);
  const rocks=await step('rocksCpu',createRockGeometry);
  const vegetation=await step('vegetationCpu',createVegetationGeometry);
  const water=await step('waterCpu',createWaterGeometry);
  return {sand,rocks,vegetation,water};
}
