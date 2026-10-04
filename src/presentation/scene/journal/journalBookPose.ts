import * as THREE from "three";
import { BOOK_HEIGHT as H, SHEET_THICKNESS, journalSheetCounts, type createJournalBookGeometry } from "./journalBookGeometry";
import { clamp } from "../../../animation/journal/inspection";
import { workspaceAppearance } from "../../../config/workspaceAppearance";

type Geometry = ReturnType<typeof createJournalBookGeometry>;
export type BookPose = { opened: number; folded: number; pages: number; page: number; zoom: number; pitch: number; yaw: number; roll: number; pan: THREE.Vector2; turning: boolean; turnProgress: number };
const ease = (value: number) => value * value * (3 - 2 * value);

export function applyJournalPose(geometry: Geometry, canvas: HTMLCanvasElement, state: BookPose, amount: number, origin: THREE.Vector3, rotation: THREE.Quaternion) {
  const { root, orientation, hinge, leftBlock, leftStack, rightStack, backCover, spine, foldedSpine, singleSheets, shapePaper, content, gutter, left, right } = geometry;
  const { folded, pages, page, opened, zoom, turning, turnProgress } = state;
  const fold = folded * ease(clamp((opened - .5) * 2, 0, 1));
  const {front:frontCount,back:backCount}=journalSheetCounts(pages,page);
  const swing = turning && zoom === 1 ? Math.sin(Math.PI * turnProgress) ** 2 * fold : 0;
  // The binding stays on the desktop; reading changes the camera, never the book's size.
  root.position.copy(origin);root.quaternion.copy(rotation);
  root.scale.set(workspaceAppearance.diary.width,workspaceAppearance.diary.height/H,.4);
  canvas.dataset.journalTravel = String(amount);
  canvas.dataset.journalPosition = root.position.toArray().join(',');
  canvas.dataset.journalScale = root.scale.toArray().join(',');
  orientation.rotation.set(0,0,0);orientation.position.set(0,0,0);
  hinge.rotation.y = -Math.PI * (opened + fold); hinge.visible = true;
  leftBlock.rotation.y = Math.PI * (1 - opened - fold); leftBlock.visible = true;
  hinge.position.z = (-.13-frontCount*SHEET_THICKNESS)*fold;
  leftBlock.position.z = -.17 * fold;
  backCover.position.z=THREE.MathUtils.lerp(-.055,-.02-frontCount*SHEET_THICKNESS,fold);
  geometry.contactShadow.visible=fold>.99&&opened>.99;
  geometry.contactShadow.position.z=backCover.position.z+.018;
  leftStack.visible=rightStack.visible=fold<.999;
  leftStack.scale.z=rightStack.scale.z=1-fold;
  singleSheets.visible=fold>0;singleSheets.scale.z=fold;
  spine.position.z = THREE.MathUtils.lerp(.00325, -.055, opened);
  spine.scale.z = THREE.MathUtils.lerp(.1515, .035, opened) / .14;
  spine.visible = fold < .99;
  foldedSpine.visible = fold > 0;
  foldedSpine.scale.set(fold, 1, fold);
  foldedSpine.position.z = THREE.MathUtils.lerp(-.055, -.044-frontCount*SHEET_THICKNESS, fold);
  shapePaper(opened,fold);
  content.position.x = -.5 - fold * .46 + .44 * swing;
  gutter.visible = fold < .01 && opened > .98;
  left.visible = fold < .999; right.visible = opened > .01;
  canvas.dataset.journalFoldAmount = String(fold);
  canvas.dataset.journalTurnProgress = turning ? String(turnProgress) : '';
  canvas.dataset.journalSheets = `${backCount},${frontCount}`;
}
