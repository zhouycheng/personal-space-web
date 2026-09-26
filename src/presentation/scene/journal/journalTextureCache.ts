import * as THREE from "three";
import type { JournalManifest } from "../../../contracts/journal";
import { createJournalImageLoader } from "../../../infrastructure/client/journalTextureLoader";
import { activeTimeout } from "../../../infrastructure/client/activeDeadline";
import { disposeSafely } from "../../../infrastructure/client/dispose";
import { journalRuntime } from "../../../config/journalRuntime";

const MAX_PAGES = journalRuntime.maxPages, CPU_LIMIT = journalRuntime.decodedBytes, GPU_LIMIT = journalRuntime.textureBytes;
type Entry = { texture: THREE.Texture; bitmap: ImageBitmap; cpu: number; gpu: number };
type Pending = { abort: AbortController; cpu: number; gpu: number };

/** Material references are pinned before a workset change can evict anything. */
export function createJournalTextureCache(anisotropy: number, changed: () => void) {
  const cache = new Map<number, Entry>(), pending = new Map<number, Pending>();
  const failures = new Map<number, string>(), listeners = new Set<() => void>();
  const load = createJournalImageLoader();
  let book: JournalManifest | undefined, generation = 0, disposed = false;
  let wanted: number[] = [], pinned = new Set<number>();
  const bytes = (index: number) => {
    const page = book!.pages[index];
    const cpu = page.imageWidth * page.imageHeight * 4;
    return { cpu, gpu: Math.ceil(cpu * 4 / 3) };
  };
  const usage = () => [...cache.values(), ...pending.values()].reduce((sum, entry) => ({ cpu: sum.cpu + entry.cpu, gpu: sum.gpu + entry.gpu }), { cpu: 0, gpu: 0 });
  function notify() { changed(); for (const listener of [...listeners]) listener(); }
  function remove(index: number) {
    const entry = cache.get(index);
    if (!entry) return;
    cache.delete(index);
    disposeSafely([() => entry.texture.dispose(), () => entry.bitmap.close()]);
  }
  function makeSpace(index: number) {
    const required = bytes(index);
    const fits = () => {
      const used = usage();
      return cache.size + pending.size < MAX_PAGES && used.cpu + required.cpu <= CPU_LIMIT && used.gpu + required.gpu <= GPU_LIMIT;
    };
    for (const id of [...cache.keys()].reverse()) {
      if (fits()) break;
      if (!pinned.has(id) && (!wanted.includes(id) || wanted.indexOf(id) > wanted.indexOf(index))) remove(id);
    }
    return fits();
  }
  function pump() {
    if (disposed || !book) return;
    for (const index of wanted) {
      if (pending.size >= journalRuntime.networkConcurrency) break;
      if (cache.has(index) || pending.has(index) || failures.has(index) || !makeSpace(index)) continue;
      const token = generation, source = book.pages[index], reservation = bytes(index);
      const task: Pending = { abort: new AbortController(), ...reservation };
      pending.set(index, task);
      void load(source.image, task.abort.signal).then(bitmap => {
        if (disposed || token !== generation || !wanted.includes(index) || task.abort.signal.aborted) { bitmap.close(); return; }
        if (bitmap.width !== source.imageWidth || bitmap.height !== source.imageHeight) {
          bitmap.close(); throw new Error("书页尺寸与清单不符，请重新加载最新日记。");
        }
        const texture = new THREE.Texture(bitmap);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
        cache.set(index, { texture, bitmap, ...reservation });
      }).catch(error => {
        if (token === generation && !task.abort.signal.aborted) failures.set(index, error instanceof Error ? error.message : "书页加载失败，请重试。");
      }).finally(() => {
        if (pending.get(index) === task) pending.delete(index);
        notify(); pump();
      });
    }
  }
  function clear() {
    generation++;
    for (const task of pending.values()) task.abort.abort();
    for (const index of cache.keys()) remove(index);
    wanted = []; pinned.clear(); failures.clear(); notify();
  }
  return {
    configure(manifest: JournalManifest) { if (manifest.renderHash !== book?.renderHash) clear(); book = manifest; disposed = false; },
    get(index: number) { return cache.get(index)?.texture; },
    has(index: number) { return cache.has(index); },
    get size() { return cache.size; },
    get stats() { const used = usage(); return { textures: cache.size, textureBytes: used.gpu, decodeBytes: used.cpu, pending: pending.size }; },
    get error() { return [...pinned].map(id => failures.get(id)).find(Boolean) ?? ""; },
    workset(required: number[], neighbors: number[]) {
      pinned = new Set(required.filter(index => Boolean(book?.pages[index])));
      wanted = [...new Set([...pinned, ...neighbors.filter(index => Boolean(book?.pages[index]))])].slice(0, MAX_PAGES);
      for (const [index, task] of pending) if (!wanted.includes(index)) task.abort.abort();
      if ([...pinned].some(index => !cache.has(index) && !pending.has(index))) {
        for (const [index, task] of pending) if (!pinned.has(index)) task.abort.abort();
      }
      for (const index of cache.keys()) if (!wanted.includes(index)) remove(index);
      pump();
    },
    waitFor(required: number[]): Promise<void> {
      const token = generation;
      return new Promise((resolve, reject) => {
        const check = () => {
          const error = required.map(id => failures.get(id)).find(Boolean);
          if (token !== generation || disposed) { cleanup(); reject(new Error("cancelled")); }
          else if (error) { cleanup(); reject(new Error(error)); }
          else if (required.every(id => cache.has(id))) { cleanup(); resolve(); }
        };
        const stop = activeTimeout(() => { cleanup(); reject(new Error("书页准备超时，请重试。")); }, journalRuntime.prepareTimeoutMs);
        const cleanup = () => { stop(); listeners.delete(check); };
        listeners.add(check); check();
      });
    },
    cancelPrefetch() {
      wanted = [...pinned];
      for (const [index, task] of pending) if (!pinned.has(index)) task.abort.abort();
    },
    cancelPending() {
      generation++;
      for (const task of pending.values()) task.abort.abort();
      wanted = [];
      notify();
    },
    clear,
    dispose() { disposed = true; clear(); },
  };
}
