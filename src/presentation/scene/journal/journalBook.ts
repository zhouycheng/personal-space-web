import * as THREE from "three";
import { createJournalBookGeometry } from "./journalBookGeometry";
import { applyJournalPose } from "./journalBookPose";
import { journalPageTargets } from "./journalBookDiagnostics";
import { createJournalTextureCache } from "./journalTextureCache";
import { spreadFor, turnFaces } from "../../../data/selectors/journalPages";
import type { JournalManifest, JournalRegion, BookReport, JournalBookPhase, JournalIntent } from "../../../contracts/journal";
import type { OperationResult } from "../../../contracts/operation";
import { clamp, constrainReading, journalSingle } from "../../../animation/journal/inspection";
import { createActiveMotion } from "../../../animation/activeMotion";
import { createBookGestures } from "../../interaction/journal/bookGestures";
import { journalRuntime } from "../../../config/journalRuntime";
import { activeTimeout, withActiveDeadline } from "../../../infrastructure/client/activeDeadline";
import { disposeSafely } from "../../../infrastructure/client/dispose";

const ease = (t: number) => t * t * (3 - 2 * t);
const completed = (): OperationResult => ({ status: "completed", value: undefined });

/** Scene-owned book rendering. Application owns identity, bookmarks, routing and entry/exit. */
export function createJournalBook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, requestDraw: () => void) {
  const geometry = createJournalBookGeometry(scene);
  const { root, orientation, owned, paper, backCover, rightStack, spine, lid,
    leftMat, rightMat, left, right, frontGeometry, backGeometry,
    frontMat, backMat, leaf, curlShadow, original } = geometry;
  const canvas = renderer.domElement, ray = new THREE.Raycaster();
  const opening = createActiveMotion(), turningMotion = createActiveMotion();
  let generation = 0, book: JournalManifest | undefined, page = 0, single = false, opened = 0;
  let active = false, disposed = false, interactionEnabled = true, error = "", zoom = 1, drawn = false;
  let phase: JournalBookPhase = "observing", pitch = -.12, yaw = -.3, roll = -.035, travelAmount = 0;
  let waiting = false, pendingTurn: 1 | -1 | undefined;
  let turning: ReturnType<typeof turnFaces> | undefined, progress = 0;
  const pan = new THREE.Vector2(), drawWaiters = new Set<() => void>();
  let report: (state: BookReport) => void = () => {}, region: (item: JournalRegion) => void = () => {};
  let intent: (event: JournalIntent) => void = () => {};
  const cache = createJournalTextureCache(Math.min(8, renderer.capabilities.getMaxAnisotropy()), () => {
    error = cache.error;
    updatePages();
  });
  const visiblePages = () => spreadFor(page, book?.pages.length ?? 0, single);
  function emit() {
    report({ page, single, busy: Boolean(turning || opening.running || waiting), error, phase, zoom, drawn, ...cache.stats });
    Object.assign(canvas.dataset, {
      journalPage: String(page), journalTextures: String(cache.size), journalBusy: String(Boolean(turning || opening.running || waiting)),
      journalPhase: phase, journalZoom: String(zoom), journalYaw: String(yaw), journalPitch: String(pitch), journalPan: `${pan.x},${pan.y}`,
      journalTextureBytes: String(cache.stats.textureBytes), journalDecodeBytes: String(cache.stats.decodeBytes), journalDrawn: String(drawn),
    });
  }
  function invalidate() { drawn = false; requestDraw(); }
  function apply(material: THREE.MeshStandardMaterial, index: number | undefined) {
    const texture = index === undefined ? null : cache.get(index) ?? null;
    if (material.map === texture) return;
    material.map = texture; material.color.setHex(texture ? 0xffffff : paper); material.needsUpdate = true;
  }
  function updatePages() {
    if (!turning) {
      const indices = visiblePages();
      apply(leftMat, single ? undefined : indices[0]); apply(rightMat, single ? indices[0] : indices[1]);
    }
    invalidate(); emit();
  }
  function warm(required = visiblePages()) {
    if (!book || disposed || !active) return;
    const center = single ? page : page - page % 2;
    const neighbors = [center, center + 1, center + 2, center + 3, center - 1, center - 2, center + 4, center - 3];
    cache.workset(required, neighbors);
  }
  function deform(value: number) {
    progress = value;
    for (const geometry of [frontGeometry, backGeometry]) {
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = original[i * 3], y = original[i * 3 + 1];
        const angle = Math.PI * value + Math.sin(Math.PI * value) * .65 * (x - .25);
        positions.setXYZ(i, x * Math.cos(angle), y, x * Math.sin(angle) + .03);
      }
      positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    }
    leaf.position.x = single ? value : 0;
    (curlShadow.material as THREE.MeshBasicMaterial).opacity = single ? 0 : Math.sin(Math.PI * value) * .12;
    curlShadow.position.x = value < .5 ? .5 : -.5;
    invalidate();
  }
  function cancelTurn(release = true) {
    turningMotion.cancel(); turning = undefined; pendingTurn = undefined;
    if (release) gestures.release(); leaf.visible = false; apply(frontMat, undefined); apply(backMat, undefined);
    (curlShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    updatePages();
  }
  function resetView(straight = false) {
    pitch = straight ? 0 : phase === "observing" ? -.12 : -.1;
    yaw = straight ? 0 : phase === "observing" ? -.3 : .08;
    roll = straight ? 0 : -.025; zoom = 1; pan.set(0, 0); emit(); invalidate();
  }
  function waitForDraw(): Promise<OperationResult> {
    const token = generation;
    if (drawn) return Promise.resolve(completed());
    return new Promise(resolve => {
      const check = () => {
        if (token !== generation || disposed || !active) { cleanup(); resolve({ status: "cancelled", reason: "inactive" }); }
        else if (error) { cleanup(); resolve({ status: "failed", code: error, retryable: true }); }
        else if (drawn) { cleanup(); resolve(completed()); }
      };
      const stop = activeTimeout(() => { cleanup(); resolve({ status: "failed", code: "书页绘制超时，请重试。", retryable: true }); }, journalRuntime.prepareTimeoutMs);
      const cleanup = () => { stop(); drawWaiters.delete(check); };
      drawWaiters.add(check); requestDraw(); check();
    });
  }
  async function open(value: boolean, reduced = false, preserveView = false): Promise<OperationResult> {
    const token = ++generation;
    cancelTurn(); opening.cancel(); waiting = value; error = "";
    if (value) {
      warm(); emit();
      try { await cache.waitFor(visiblePages()); }
      catch (cause) {
        if (token !== generation) return { status: "cancelled", reason: "superseded" };
        waiting = false; error = cause instanceof Error ? cause.message : "书页加载失败"; emit();
        return { status: "failed", code: error, retryable: true };
      }
    }
    if (token !== generation || !active) return { status: "cancelled", reason: "inactive" };
    waiting = false; phase = value ? "opening" : "closing";
    if (!preserveView) resetView();
    const from = opened, to = value ? 1 : 0;
    const pending = opening.start(reduced ? 0 : journalRuntime.coverDurationMs, t => { opened = THREE.MathUtils.lerp(from, to, ease(t)); invalidate(); });
    emit(); requestDraw();
    const result = await withActiveDeadline(pending, journalRuntime.coverDurationMs + journalRuntime.animationSlackMs, () => opening.cancel("timeout"));
    if (result.status === "failed" && token === generation) { error = result.code; emit(); return result; }
    if (result.status !== "completed" || token !== generation) return { status: "cancelled", reason: "superseded" };
    phase = value ? "reading" : "observing"; updatePages();
    return waitForDraw();
  }
  function setZoom(value: number) { zoom = clamp(value, 1, 2.4); if (zoom === 1) pan.set(0, 0); emit(); invalidate(); }
  function requiredFor(turn: NonNullable<ReturnType<typeof turnFaces>>) {
    return [...new Set([...visiblePages(), turn.front, turn.back, ...spreadFor(turn.to, book!.pages.length, single)])].filter(i => Boolean(book!.pages[i]));
  }
  function begin(direction: 1 | -1) {
    if (!active || phase !== "reading" || travelAmount < 1 || turning || waiting || !book) return false;
    const turn = turnFaces(page, book.pages.length, single, direction); if (!turn) return false;
    const required = requiredFor(turn); warm(required);
    if (required.some(i => !cache.has(i))) return false;
    turning = turn;
    if (single) { apply(frontMat, direction === 1 ? page : turn.to); apply(backMat, direction === 1 ? turn.to : page); left.visible = false; right.visible = false; }
    else { apply(frontMat, turn.front); apply(backMat, turn.back); if (direction === 1) apply(rightMat, turn.to + 1); else apply(leftMat, turn.to); }
    leaf.visible = true; deform(direction === 1 ? 0 : 1); emit(); return true;
  }
  async function finish(commit: boolean, reduced = false) {
    if (!turning) return;
    const turn = turning, from = progress, token = generation;
    const target = commit ? (turn.direction === 1 ? 1 : 0) : (turn.direction === 1 ? 0 : 1);
    const task = turningMotion.start(reduced ? 0 : Math.max(120, Math.abs(target - progress) * journalRuntime.pageDurationMs), t => deform(THREE.MathUtils.lerp(from, target, ease(t))));
    requestDraw();
    const result = await withActiveDeadline(task, journalRuntime.pageDurationMs + journalRuntime.animationSlackMs, () => turningMotion.cancel("timeout"));
    if (result.status === "failed" && token === generation) { cancelTurn(); error = result.code; emit(); return; }
    if (result.status !== "completed" || token !== generation || turning !== turn) return;
    if (commit) page = turn.to;
    const queued = pendingTurn; cancelTurn(); warm(); updatePages();
    const drawnResult = await waitForDraw();
    if (queued && drawnResult.status === "completed") void turnPage(queued, reduced);
  }
  async function turnPage(direction: 1 | -1, reduced = false) {
    refreshLayout();
    if (turning || waiting) { pendingTurn = direction; return; }
    if (!book || phase !== "reading" || !active) return;
    const turn = turnFaces(page, book.pages.length, single, direction); if (!turn) return;
    const token = generation, required = requiredFor(turn); warm(required); waiting = true; emit();
    try { await cache.waitFor(required); }
    catch (cause) { if (token === generation) { waiting = false; error = cause instanceof Error ? cause.message : "书页加载失败"; emit(); } return; }
    if (token !== generation) return;
    waiting = false;
    if (begin(direction)) void finish(true, reduced);
  }
  function hit(event: PointerEvent) {
    orientation.rotation.set(pitch * travelAmount, yaw * travelAmount, roll * travelAmount, "YXZ");
    root.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return undefined;
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    return ray.intersectObjects(phase === "observing" ? [lid, backCover, spine, rightStack] : single ? [right] : [left, right])[0];
  }
  function hitRegion(found: THREE.Intersection) {
    if (!found.uv || !book || phase !== "reading") return undefined;
    const ids = visiblePages(), id = single ? ids[0] : found.object === left ? ids[0] : ids[1];
    const x = found.uv.x * book.width, y = (1 - found.uv.y) * book.height;
    return book.pages[id]?.regions.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
  }
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gestures = createBookGestures({
    canvas, enabled: () => active && travelAmount === 1 && !opening.running && !waiting && interactionEnabled && !turningMotion.running,
    phase: () => phase, zoom: () => zoom, single: () => single,
    hit(event) { const found = hit(event); return found?.uv ? { x: found.uv.x, y: found.uv.y, left: found.object === left, cover: found.object === lid, region: Boolean(hitRegion(found)) } : undefined; },
    begin, deform, progress: () => progress, finish: commit => { void finish(commit, reduced()); },
    rotate(dx, dy) { yaw += dx * .007; pitch += dy * .007; if (phase === "reading") ({ pitch, yaw } = constrainReading(pitch, yaw)); emit(); invalidate(); },
    pan(dx, dy) { pan.x = clamp(pan.x + dx * .002, -.8, .8); pan.y = clamp(pan.y - dy * .002, -.8, .8); emit(); invalidate(); },
    setZoom, interrupt: () => cancelTurn(false),
    click(event) {
      const found = hit(event); if (!found?.uv) return;
      if (phase === "observing") { if (found.object === lid) intent({ kind: "open" }); return; }
      const target = hitRegion(found); if (target) { region(target); return; }
      intent({ kind: "turn", direction: single ? (found.uv.x < .5 ? -1 : 1) : found.object === left ? -1 : 1 });
    },
  });
  function cancel() {
    generation++; waiting = false; opening.cancel(); cancelTurn(); cache.cancelPending();
    phase = opened >= .5 ? "reading" : "observing"; opened = phase === "reading" ? 1 : 0;
    for (const check of [...drawWaiters]) check(); emit();
  }
  function refreshLayout() {
    // The renderer's canvas can still carry the previous CSS width until its
    // ResizeObserver runs. Input must use the current host viewport immediately.
    const rect = (canvas.parentElement ?? canvas).getBoundingClientRect(), next = journalSingle(rect.width, rect.height);
    if (next === single) return;
    cancel(); single = next; updatePages(); warm();
  }
  function activate(value: boolean) {
    active = value; root.visible = value;
    if (!value) {
      cancel(); for (const material of [leftMat, rightMat, frontMat, backMat]) apply(material, undefined); cache.clear(); drawn = false;
    } else { error = ""; warm(); }
    emit(); requestDraw();
  }
  return {
    root,
    setInteractionEnabled(value: boolean) { interactionEnabled = value; if (!value) gestures.cancel(); },
    configure(manifest: JournalManifest, onReport: typeof report, onRegion: typeof region, onIntent: typeof intent) {
      // Teardown belongs to the previous operation. Reset resources and errors
      // before installing callbacks for the new session, including same-version retries.
      report = () => {};
      activate(false);
      book = manifest; cache.configure(manifest); error = "";
      report = onReport; region = onRegion; intent = onIntent;
    },
    activate,
    prepare(reading: boolean) { cancel(); opened = reading ? 1 : 0; phase = reading ? "reading" : "observing"; resetView(); },
    open, ready: waitForDraw,
    afterRender() {
      if (!active || travelAmount !== 1 || error || !visiblePages().length || !visiblePages().every(index => cache.has(index))) return;
      if (!drawn) {
        const indices = visiblePages();
        const surfaces = indices.map((index, position) => ({ index, mesh: single || position === 1 ? right : left, left: !single && position === 0 }));
        canvas.dataset.journalPageTargets = JSON.stringify(journalPageTargets(camera, canvas, surfaces));
        drawn = true; emit(); for (const check of [...drawWaiters]) check();
      }
    },
    resetView() { resetView(true); },
    setPage(index: number) { cancel(); page = Math.max(0, Math.min((book?.pages.length ?? 1) - 1, index)); updatePages(); warm(); },
    resize() { refreshLayout(); invalidate(); },
    setZoom,
    pose(amount: number, origin: THREE.Vector3, rotation: THREE.Quaternion) {
      travelAmount = amount;
      applyJournalPose(geometry, camera, canvas, { opened, single, zoom, pitch, yaw, roll, pan, turning: Boolean(turning) }, amount, origin, rotation);
    },
    turn: turnPage,
    cancel,
    pause() { opening.pause(); turningMotion.pause(); gestures.cancel(); },
    cancelPrefetch() { cache.cancelPrefetch(); },
    tick(now: number) { const a = opening.tick(now), b = turningMotion.tick(now); return a || b; },
    dispose() {
      if (disposed) return; disposed = true; active = false;
      disposeSafely([cancel, () => gestures.dispose(),
        ...[leftMat, rightMat, frontMat, backMat].map(material => () => apply(material, undefined)),
        () => cache.dispose(), ...owned.map(resource => () => resource.dispose()), () => scene.remove(root)]);
    },
  };
}
