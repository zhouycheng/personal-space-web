import * as THREE from "three";
import { BOOK_HEIGHT as H, type createJournalBookGeometry } from "./journalBookGeometry";
import { clamp } from "../../../animation/journal/inspection";

type Geometry = ReturnType<typeof createJournalBookGeometry>;
export type BookPose = { opened: number; single: boolean; zoom: number; pitch: number; yaw: number; roll: number; pan: THREE.Vector2; turning: boolean };
const ease = (value: number) => value * value * (3 - 2 * value);

export function applyJournalPose(geometry: Geometry, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, state: BookPose, amount: number, origin: THREE.Vector3, rotation: THREE.Quaternion) {
  const { root, orientation, hinge, leftBlock, spine, shapePaper, content, gutter, left, right } = geometry;
  const { single, opened, zoom, pan, pitch, yaw, roll, turning } = state;
  const distance = Math.min(3, Math.max(.8, camera.position.distanceTo(origin) * .45));
  const availableH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const width = single ? 1.14 : THREE.MathUtils.lerp(1.14, 2.2, opened);
  const fit = Math.min(availableH * THREE.MathUtils.lerp(.58, .68, opened) / H, availableH * camera.aspect * .85 / width) * zoom * (1 - .22 * Math.sin(Math.PI * opened));
  const end = new THREE.Vector3(0, .01, -distance).applyQuaternion(camera.quaternion).add(camera.position);
  // Clear the drawer vertically at real size before rotating and enlarging.
  const lifted = origin.clone(); lifted.y = 1.65;
  const clearance = lifted.clone(); clearance.y = 1.9; clearance.z = 1.2;
  const travel = ease(clamp((amount - .55) / .45, 0, 1));
  if (amount < .28) root.position.lerpVectors(origin, lifted, ease(amount / .28));
  else if (amount < .55) root.position.lerpVectors(lifted, clearance, ease((amount - .28) / .27));
  else root.position.lerpVectors(clearance, end, travel);
  root.quaternion.slerpQuaternions(rotation, camera.quaternion, travel);
  root.scale.set(THREE.MathUtils.lerp(.39, fit, travel), THREE.MathUtils.lerp(.47 / H, fit, travel), THREE.MathUtils.lerp(.4, fit, travel));
  canvas.dataset.journalTravel = String(amount);
  canvas.dataset.journalPosition = root.position.toArray().join(',');
  canvas.dataset.journalScale = root.scale.toArray().join(',');
  orientation.rotation.set(pitch * travel, yaw * travel, roll * travel, 'YXZ');
  orientation.position.set(pan.x * travel, pan.y * travel, 0);
  hinge.rotation.y = -Math.PI * opened; hinge.visible = single ? opened < 1 : true;
  leftBlock.rotation.y = Math.PI * (1 - opened); leftBlock.visible = !single || opened < 1;
  spine.position.z = THREE.MathUtils.lerp(.00325, -.055, opened);
  spine.scale.z = THREE.MathUtils.lerp(.1515, .035, opened) / .14;
  shapePaper(opened);
  content.position.x = single ? -.5 : THREE.MathUtils.lerp(-.5, 0, opened);
  gutter.visible = !single && opened > .98;
  left.visible = !single; right.visible = opened > .01 && !(single && turning);
}
