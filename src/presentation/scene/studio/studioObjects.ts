import * as THREE from "three";
import type { StudioSceneFile } from "../../../contracts/studio";
import { createStudioPrimitives } from "./studioPrimitives";
import { createStudioFurniture } from "./studioFurniture";
import { createStudioDevices } from "./studioDevices";
import { createStudioAtmosphere } from "./studioAtmosphere";

export function createStudioObjects({ renderer, scene, room, studioFiles, materials, geometries, textures, cleanup }: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  room: THREE.Group;
  studioFiles: readonly StudioSceneFile[];
  materials: Set<THREE.Material>;
  geometries: Set<THREE.BufferGeometry>;
  textures: Set<THREE.Texture>;
  cleanup: (() => void)[];
}) {
  const primitives = createStudioPrimitives(renderer, room, materials, geometries, textures);
  const { drawerActions, drawers, diary, chair, casters, chairWheels } =
    createStudioFurniture(scene, room, primitives, materials, textures, renderer);
  const { computerSurface, canvasSurface } =
    createStudioDevices(primitives, studioFiles, renderer, materials, geometries, textures);
  const { steam, deskClock, clockImage, clockTexture, lampModel, diffuserMaterial, lamp, sun, ambient } =
    createStudioAtmosphere(scene, room, primitives, materials, textures, cleanup);

  return {
    drawerActions, drawers, diary, computerSurface, canvasSurface,
    chair, casters, chairWheels, steam, deskClock, clockImage, clockTexture,
    lampModel, diffuserMaterial, lamp, sun, ambient,
  };
}
