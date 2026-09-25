import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { studioPalette as palette } from "../../../config/studioPalette";
import type { StudioAction } from "../../../contracts/studio";

export function createStudioPrimitives(renderer: THREE.WebGLRenderer, room: THREE.Group, materials: Set<THREE.Material>, geometries: Set<THREE.BufferGeometry>, textures: Set<THREE.Texture>) {
  function material(color: number, roughness = 0.8) {
    const result = new THREE.MeshStandardMaterial({ color, roughness });
    materials.add(result);
    return result;
  }
  const wood = material(palette.wood);
  const charcoal = material(palette.frame);
  const brass = material(palette.metal, 0.4);
  const paper = material(palette.paper);
  const furnitureFrame = material(palette.frame);
  const upholstery = material(palette.upholstery, 0.95);
  const aluminum = material(0x8c9198, 0.4);
  aluminum.metalness = 0.55;
  const keycap = material(0x22262b);
  const rubber = material(0x202523);
  const chrome = material(0x999f9c, 0.3);
  chrome.metalness = 0.65;

  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  function box(parent: THREE.Object3D, size: number[], at: number[], mat = wood) {
    return mesh(parent, new THREE.BoxGeometry(...size as [number, number, number]), mat, ...at as [number, number, number]);
  }
  function cylinder(parent: THREE.Object3D, radius: number, height: number, at: number[], mat = charcoal, top = radius) {
    return mesh(parent, new THREE.CylinderGeometry(top, radius, height, 16), mat, ...at as [number, number, number]);
  }
  function rounded(parent: THREE.Object3D, size: [number,number,number], at: [number,number,number], mat: THREE.Material, radius: number) {
    return mesh(parent, new RoundedBoxGeometry(...size, 2, radius), mat, ...at);
  }
  function hotspot(action: StudioAction) {
    const group = new THREE.Group();
    group.userData.action = action;
    room.add(group);
    return group;
  }
  function label(parent: THREE.Object3D, text: string, width: number, height: number, at: number[], background = "#002fa7", color = "#fff9e9", fontScale = 0.156) {
    const image = document.createElement("canvas");
    image.width = 1024;
    image.height = Math.round(1024 * height / width);
    const ctx = image.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, image.width, image.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(image.height * fontScale)}px monospace`;
    ctx.fillText(text, image.width / 2, image.height / 2, image.width * 0.9);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures.add(texture);
    const labelMaterial = new THREE.MeshBasicMaterial({ map: texture });
    materials.add(labelMaterial);
    return mesh(parent, new THREE.PlaneGeometry(width, height), labelMaterial, ...at as [number, number, number]);
  }
  return { material, mesh, box, cylinder, rounded, hotspot, label,
    wood, charcoal, brass, paper, furnitureFrame, upholstery,
    aluminum, keycap, rubber, chrome };
}

export type StudioPrimitives = ReturnType<typeof createStudioPrimitives>;
