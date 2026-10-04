import * as THREE from "three";
import { createJournalBookGeometry, shapeTurningPage, shapeFoldedPage, singleBackDepth } from "./journalBookGeometry";
import { applyJournalPose } from "./journalBookPose";
import { journalPageTargets } from "./journalBookDiagnostics";
import { createJournalTextureCache } from "./journalTextureCache";
import { spreadFor, turnFaces } from "../../../data/selectors/journalPages";
import type { JournalManifest, JournalRegion, BookReport, JournalBookPhase, JournalIntent } from "../../../contracts/journal";
import type { OperationResult } from "../../../contracts/operation";
import { clamp, constrainReading, journalSingle } from "../../../animation/journal/inspection";
import { createActiveMotion } from "../../../animation/activeMotion";
import { createBookGestures, type PageTurnGrip } from "../../interaction/journal/bookGestures";
import { journalRuntime } from "../../../config/journalRuntime";
import { activeTimeout, withActiveDeadline } from "../../../infrastructure/client/activeDeadline";
import { disposeSafely } from "../../../infrastructure/client/dispose";
import { workspaceAppearance } from "../../../config/workspaceAppearance";
import { readingStep } from "../../../animation/journal/readingNavigation";

const ease = (t: number) => t * t * (3 - 2 * t);
const completed = (): OperationResult => ({ status: "completed", value: undefined });

/** Scene-owned book rendering. Application owns identity, bookmarks, routing and entry/exit. */
export function createJournalBook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, requestDraw: () => void) {
  const geometry = createJournalBookGeometry(scene);
  const { root, owned, paper, backCover, rightStack, spine, lid,
    leftMat, rightMat, left, right, frontGeometry, backGeometry,
    frontMat, backMat, leaf, curlShadow, original } = geometry;
  backCover.castShadow=lid.castShadow=true;
  const canvas = renderer.domElement, ray = new THREE.Raycaster();
  const opening = createActiveMotion(), turningMotion = createActiveMotion(), layoutMotion = createActiveMotion();
  const viewMotion=createActiveMotion();
  let narrow=false,focusSide=-.5;
  let generation = 0, book: JournalManifest | undefined, page = 0, single = false, opened = 0, folded = 0;
  let active = false, disposed = false, interactionEnabled = true, error = "", zoom = 1, drawn = false;
  let phase: JournalBookPhase = "observing", pitch = -.12, yaw = -.3, roll = -.035, travelAmount = 0;
  let waiting = false, pendingTurn: 1 | -1 | undefined;
  let turning: ReturnType<typeof turnFaces> | undefined, progress = 0, turnSequence = 0;
  let turnGrip: PageTurnGrip = { u: .94, v: 0, skew: 0 };
  const pan = new THREE.Vector2(), drawWaiters = new Set<() => void>();
  let report: (state: BookReport) => void = () => {}, region: (item: JournalRegion) => void = () => {};
  let intent: (event: JournalIntent) => void = () => {};
  const cache = createJournalTextureCache(Math.min(8, renderer.capabilities.getMaxAnisotropy()), () => {
    error = cache.error;
    updatePages();
  });
  const visiblePages = () => spreadFor(page, book?.pages.length ?? 0, single);
  function emit() {
    report({ page, single:narrow, busy: Boolean(turning || opening.running || layoutMotion.running || viewMotion.running || waiting), error, phase, zoom, drawn, ...cache.stats });
    Object.assign(canvas.dataset, {
      journalPage: String(page), journalTextures: String(cache.size), journalBusy: String(Boolean(turning || opening.running || layoutMotion.running || viewMotion.running || waiting)),
      journalPhase: phase, journalZoom: String(zoom), journalYaw: String(yaw), journalPitch: String(pitch), journalPan: `${pan.x},${pan.y}`,
      journalTextureBytes: String(cache.stats.textureBytes), journalDecodeBytes: String(cache.stats.decodeBytes), journalDrawn: String(drawn),
    });
  }
  function invalidate() { drawn = false; canvas.dataset.journalDrawn = "false"; requestDraw(); }
  function apply(material: THREE.MeshStandardMaterial, index: number | undefined) {
    const texture = index === undefined ? null : cache.get(index) ?? null;
    if (material.map === texture) return;
    const programChanged=Boolean(material.map)!==Boolean(texture)||material.map?.channel!==texture?.channel;
    material.map = texture; material.color.setHex(texture ? 0xffffff : paper);
    // A reading-only fill keeps printed ink readable after leaving the task lamp.
    // Multiplying by the page texture preserves dark ink instead of whitening it.
    material.emissiveMap = texture;
    material.emissive.setHex(texture ? 0xffffff : paper);
    if(programChanged)material.needsUpdate = true;
  }
  function updatePages() {
    if (!turning) {
      const indices = visiblePages();
      apply(leftMat, single ? undefined : indices[0]); apply(rightMat, single ? indices[0] : indices[1]);
      if(book) geometry.updateSingleSheets(book.pages.length,page);
    }
    invalidate(); emit();
  }
  function warm(required = visiblePages()) {
    if (!book || disposed || !active) return;
    const center = single ? page : page - page % 2;
    const neighbors = single ? [page, page + 1, page - 1, page + 2, page - 2] : [center, center + 1, center + 2, center + 3, center - 1, center - 2, center + 4, center - 3];
    cache.workset(required, neighbors);
  }
  function deform(value: number, grip = turnGrip) {
    progress = clamp(value, 0, 1); turnGrip = grip;
    const direction = turning?.direction ?? 1, lift = Math.sin(Math.PI * progress);
    if (single) shapeFoldedPage(frontGeometry, original, direction === 1 ? progress : 1 - progress, grip, singleBackDepth(book?.pages.length ?? 0));
    else shapeTurningPage(frontGeometry, original, progress, direction, grip);
    for(const attribute of ['position','normal']) {
      const target=backGeometry.getAttribute(attribute) as THREE.BufferAttribute;
      (target.array as Float32Array).set(frontGeometry.getAttribute(attribute).array);
      target.needsUpdate=true;
    }
    if(frontGeometry.boundingSphere)(backGeometry.boundingSphere??=new THREE.Sphere()).copy(frontGeometry.boundingSphere);
    if(frontGeometry.boundingBox)(backGeometry.boundingBox??=new THREE.Box3()).copy(frontGeometry.boundingBox);
    leaf.position.x = 0;
    curlShadow.scale.x = .35 + .65 * Math.abs(Math.cos(Math.PI * progress));
    curlShadow.position.x = direction === -1 ? -.5 + progress : .5 - progress;
    curlShadow.rotation.z = grip.skew * lift * .04;
    (curlShadow.material as THREE.MeshBasicMaterial).opacity = single ? 0 : lift * (.11 + .08 * Math.abs(grip.v));
    invalidate();
  }
  function cancelTurn(release = true) {
    turningMotion.cancel(); turning = undefined; pendingTurn = undefined;
    if (release) gestures.release(); leaf.visible = false; apply(frontMat, undefined); apply(backMat, undefined);
    (curlShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    updatePages();
  }
  function resetView() {
    pitch = .16; yaw=roll=0; zoom = 1; pan.set(0, 0); emit(); invalidate();
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
    const coverDuration = single ? 1100 : journalRuntime.coverDurationMs;
    const pending = opening.start(reduced ? 0 : coverDuration, t => { opened = THREE.MathUtils.lerp(from, to, ease(t)); invalidate(); });
    emit(); requestDraw();
    const result = await withActiveDeadline(pending, coverDuration + journalRuntime.animationSlackMs, () => opening.cancel("timeout"));
    if (result.status === "failed" && token === generation) { error = result.code; emit(); return result; }
    if (result.status !== "completed" || token !== generation) return { status: "cancelled", reason: "superseded" };
    phase = value ? "reading" : "observing"; updatePages();
    return waitForDraw();
  }
  function setZoom(value: number) { zoom = clamp(value, 1, 2.4); if (zoom === 1) pan.set(0, 0); emit(); invalidate(); }
  function requiredFor(turn: NonNullable<ReturnType<typeof turnFaces>>) {
    return [...new Set([...visiblePages(), turn.front, turn.back, ...spreadFor(turn.to, book!.pages.length, single)])].filter(i => Boolean(book!.pages[i]));
  }
  function begin(direction: 1 | -1, grip?: PageTurnGrip) {
    if (!active || phase !== "reading" || travelAmount < 1 || turning || waiting || layoutMotion.running || viewMotion.running || !book) return false;
    const turn = turnFaces(page, book.pages.length, single, direction); if (!turn) return false;
    const required = requiredFor(turn); warm(required);
    if (required.some(i => !cache.has(i))) return false;
    turning = turn;
    if (grip) turnGrip = grip;
    else if (single) turnGrip = { u: .94, v: .25, skew: 0 };
    else {
      const seed = ++turnSequence * 2.399963 + (direction === 1 ? .65 : 1.4);
      turnGrip = { u: .94, v: Math.sin(seed) * .48, skew: Math.cos(seed) * .3 };
    }
    if (single) {
      apply(frontMat, direction === 1 ? page : turn.to); apply(backMat, undefined);
      apply(rightMat, direction === 1 ? turn.to : page);
      geometry.updateSingleSheets(book.pages.length,page,direction<0&&Math.floor(turn.to/2)<Math.floor(page/2)?'back':'front');
    }
    else { apply(frontMat, turn.front); apply(backMat, turn.back); if (direction === 1) apply(rightMat, turn.to + 1); else apply(leftMat, turn.to); }
    leaf.visible = true; deform(0, turnGrip); emit(); return true;
  }
  async function finish(commit: boolean, reduced = false, velocity = 0) {
    if (!turning) return;
    const turn = turning, from = progress, token = generation, target = commit ? 1 : 0;
    const fromSide=focusSide,toSide=commit?(turn.direction===1?-.5:.5):page%2-.5;
    const pageDuration = single ? 1350 : journalRuntime.pageDurationMs;
    const duration = reduced ? 0 : pageDuration;
    const damping = single ? .94 : .88, frequency = single ? 6.2 : 8.5;
    const dampedFrequency = frequency * Math.sqrt(1 - damping * damping);
    const offset = from - target, tangent = (clamp(velocity, -3, 3) + damping * frequency * offset) / dampedFrequency;
    const task = turningMotion.start(duration, t => {
      if(narrow)focusSide=THREE.MathUtils.lerp(fromSide,toSide,ease(t));
      if (!duration) { deform(target); return; }
      const seconds = t * duration / 1000, envelope = Math.exp(-damping * frequency * seconds);
      const value = target + envelope * (offset * Math.cos(dampedFrequency * seconds) + tangent * Math.sin(dampedFrequency * seconds));
      deform(clamp(value, 0, 1));
    });
    requestDraw();
    const result = await withActiveDeadline(task, pageDuration + journalRuntime.animationSlackMs, () => turningMotion.cancel("timeout"));
    if (result.status === "failed" && token === generation) { cancelTurn(); error = result.code; emit(); return; }
    if (result.status !== "completed" || token !== generation || turning !== turn) return;
    deform(target);
    if (commit) {page = turn.to+(narrow&&turn.direction<0?1:0);focusSide=page%2-.5;}
    const queued = pendingTurn; cancelTurn(); warm(); updatePages();
    const drawnResult = await waitForDraw();
    if (queued && drawnResult.status === "completed") void turnPage(queued, reduced);
  }
  async function turnPage(direction: 1 | -1, reduced = false) {
    refreshLayout();
    if (turning || waiting || viewMotion.running) { pendingTurn = direction; return; }
    if (!book || phase !== "reading" || !active) return;
    const next=readingStep(page,book.pages.length,narrow,direction);if(!next)return;
    if(next.panOnly){
      const from=focusSide,to=next.page%2-.5,token=generation;
      page=next.page;
      const task=viewMotion.start(reduced?0:420,t=>{focusSide=THREE.MathUtils.lerp(from,to,ease(t));invalidate();});
      emit();requestDraw();const result=await task;
      if(result.status==='completed'&&token===generation){const queued=pendingTurn;pendingTurn=undefined;updatePages();if(queued)void turnPage(queued,reduced);}
      return;
    }
    const turn = turnFaces(page, book.pages.length, single, direction); if (!turn) return;
    const token = generation, required = requiredFor(turn); warm(required); waiting = true; emit();
    try { await cache.waitFor(required); }
    catch (cause) { if (token === generation) { waiting = false; error = cause instanceof Error ? cause.message : "书页加载失败"; emit(); } return; }
    if (token !== generation) return;
    waiting = false;
    if (begin(direction)) void finish(true, reduced);
  }
  function hit(event: PointerEvent) {
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
    canvas, enabled: () => active && travelAmount === 1 && !opening.running && !layoutMotion.running && !viewMotion.running && !waiting && interactionEnabled && !turningMotion.running,
    phase: () => phase, zoom: () => zoom, single: () => single,canDragTurn:()=>!narrow,
    hit(event) { const found = hit(event); return found?.uv ? { x: found.uv.x, y: found.uv.y, left: found.object === left, cover: found.object === lid, region: Boolean(hitRegion(found)) } : undefined; },
    begin: (direction,grip)=>!narrow&&begin(direction,grip), deform, progress: () => progress, finish: (commit, velocity) => { void finish(commit, reduced(), velocity); },
    rotate(dx, dy) { ({ pitch, yaw } = constrainReading(pitch+dy*.002, yaw+dx*.002)); emit(); invalidate(); },
    pan(dx, dy) { pan.x = clamp(pan.x + dx * .002, -.8, .8); pan.y = clamp(pan.y - dy * .002, -.8, .8); emit(); invalidate(); },
    setZoom, interrupt: () => cancelTurn(false),
    click(event) {
      const found = hit(event); if (!found?.uv) return;
      if (phase === "observing") { if (found.object === lid) intent({ kind: "open" }); return; }
      const target = hitRegion(found); if (target) { region(target); return; }
      const rect=canvas.getBoundingClientRect();
      intent({ kind: "turn", direction: narrow ? (event.clientX<rect.left+rect.width*.5?-1:1) : found.object === left ? -1 : 1 });
    },
  });
  function cancel() {
    generation++; waiting = false; opening.cancel(); layoutMotion.cancel();viewMotion.cancel();focusSide=page%2-.5; folded = single ? 1 : 0; cancelTurn(); cache.cancelPending();
    phase = opened >= .5 ? "reading" : "observing"; opened = phase === "reading" ? 1 : 0;
    for (const check of [...drawWaiters]) check(); emit();
  }
  function refreshLayout() {
    // The renderer's canvas can still carry the previous CSS width until its
    // ResizeObserver runs. Input must use the current host viewport immediately.
    const rect = (canvas.parentElement ?? canvas).getBoundingClientRect(), next = journalSingle(rect.width, rect.height);
    if (next === narrow) return;
    cancel(); narrow = next;focusSide=page%2-.5;
    updatePages(); warm();
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
    get single() { return narrow; },
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
    resetView,
    setPage(index: number) { cancel(); page = Math.max(0, Math.min((book?.pages.length ?? 1) - 1, index));focusSide=page%2-.5; updatePages(); warm(); },
    resize() { refreshLayout(); invalidate(); },
    setZoom,
    pose(amount: number, origin: THREE.Vector3, rotation: THREE.Quaternion) {
      travelAmount = amount;
      for (const material of [leftMat, rightMat, frontMat, backMat]) material.emissiveIntensity = .32 * ease(clamp((amount - .55) / .45, 0, 1));
      applyJournalPose(geometry, canvas, { opened, folded, pages:book?.pages.length ?? 0, page, zoom, pitch, yaw, roll, pan, turning: Boolean(turning), turnProgress: progress }, amount, origin, rotation);
    },
    turn: turnPage,
    cancel,
    readingView(position:THREE.Vector3,look:THREE.Vector3){
      root.updateWorldMatrix(true,true);
      const width=workspaceAppearance.diary.width,height=workspaceAppearance.diary.height;
      look.set((-.5+(narrow?focusSide:0))*opened+pan.x,pan.y,0);root.localToWorld(look);
      const distance=Math.max(height*1.55,(narrow?width*1.18:width*2.35)/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))/zoom;
      position.set(Math.sin(yaw)*distance,-Math.sin(pitch)*distance,Math.cos(pitch)*Math.cos(yaw)*distance).applyQuaternion(root.quaternion).add(look);
    },
    pause() { opening.pause(); turningMotion.pause(); layoutMotion.pause();viewMotion.pause(); gestures.cancel(); },
    cancelPrefetch() { cache.cancelPrefetch(); },
    tick(now: number) { const a = opening.tick(now), b = turningMotion.tick(now), c = layoutMotion.tick(now),d=viewMotion.tick(now); return a || b || c || d; },
    dispose() {
      if (disposed) return; disposed = true; active = false;
      disposeSafely([cancel, () => gestures.dispose(),
        ...[leftMat, rightMat, frontMat, backMat].map(material => () => apply(material, undefined)),
        () => cache.dispose(), geometry.disposeSingleSheets, ...owned.map(resource => () => resource.dispose()), () => scene.remove(root)]);
    },
  };
}
