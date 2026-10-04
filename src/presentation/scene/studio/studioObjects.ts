import * as THREE from "three";
import type { StudioSceneFile } from "../../../contracts/studio";
import { createStudioPrimitives } from "./studioPrimitives";
import { createStudioFurniture } from "./studioFurniture";
import { createStudioFiles } from "./studioFiles";
import { createStudioDevices } from "./studioDevices";
import { createStudioAtmosphere } from "./studioAtmosphere";
import { createWorkspaceCanopy } from "./workspaceCanopy";
import { createIslandDressing } from './islandDressing.ts';
import { createIslandLeisure } from './islandLeisure.ts';
import { batchStaticChildren } from './staticBatches.ts';

export function createStudioObjects({ renderer, scene, room, studioFiles, computerLabel, materials, geometries, textures, cleanup }: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  room: THREE.Group;
  studioFiles: readonly StudioSceneFile[];
  computerLabel: string;
  materials: Set<THREE.Material>;
  geometries: Set<THREE.BufferGeometry>;
  textures: Set<THREE.Texture>;
  cleanup: (() => void)[];
}) {
  const primitives = createStudioPrimitives(renderer, room, materials, geometries, textures);
  const canopy=createWorkspaceCanopy(scene,primitives,materials,textures);
  const dressing=createIslandDressing(primitives,materials,geometries,textures);
  scene.add(dressing.group);cleanup.push(()=>scene.remove(dressing.group));
  const leisure=createIslandLeisure(primitives,materials,textures);
  scene.add(leisure.group);cleanup.push(()=>scene.remove(leisure.group));
  cleanup.push(()=>scene.remove(canopy.group));
  const { drawerActions, drawers, diary, chair, chairSeat } =
    createStudioFurniture(room, primitives, materials, textures);
  const { computerSurface, canvasSurface, screenGlow, tabletGlow } =
    createStudioDevices(primitives, renderer, materials, textures, computerLabel);
  createStudioFiles(primitives,studioFiles,materials,geometries,textures);
  const { steam, deskClock, clockImage, clockTexture, lampModel, diffuserMaterial, lamp, sun, ambient } =
    createStudioAtmosphere(scene, room, primitives, materials, textures, cleanup);
  batchStaticChildren(room,geometries,new Set([computerSurface,canvasSurface,deskClock]));
  primitives.releaseConstructionGeometry(scene);

  return {
    canopy,dressing,leisure,
    drawerActions, drawers, diary, computerSurface, canvasSurface,
    chair, chairSeat, steam, deskClock, clockImage, clockTexture,
    lampModel, diffuserMaterial, lamp, sun, ambient, screenGlow, tabletGlow,
  };
}
