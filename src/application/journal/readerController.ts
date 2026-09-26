import type { BookReport, JournalAvailability, JournalManifest, JournalSession, JournalRegion, ReadingAnchor, JournalIntent } from "../../contracts/journal";
import type { ScenePort } from "../../contracts/studioPorts";
import type { OperationResult } from "../../contracts/operation";
import { resolveReadingPage } from "./book-state.ts";
import { journalRuntime } from "../../config/journalRuntime.ts";
import { createJournalSessionStore } from "../../data/stores/journalSession.ts";

export type ReadingRequest = { slug?: string; anchor?: string };
type Services = {
  scene(): ScenePort | undefined;
  saved: ReadingAnchor | null;
  save(bookmark: ReadingAnchor): void;
  replaceArticle(slug: string): void;
  region(region: JournalRegion): void;
  exit(): void;
  recovering?(): Promise<void>;
  deadline(task: Promise<OperationResult>, milliseconds: number, cancel: () => void): Promise<OperationResult>;
};

/** One controller commits stable reading locations after a rendered, completed operation. */
export function createJournalController(book: JournalManifest, services: Services) {
  const $session = createJournalSessionStore(book.availability, book.error);
  let generation = 0, saved = services.saved, request: ReadingRequest = {}, disposed = false;
  let stablePage = -1;
  const set = (patch: Partial<JournalSession>) => $session.set({ ...$session.get(), ...patch });
  const current = () => $session.get();
  function failed(message: string, availability: JournalAvailability = "error") {
    if (!current().active) return;
    generation++;
    set({ availability, error: message, busy: false });
    try { services.scene()?.setJournalInteractionEnabled(false); }
    catch { /* A broken scene must not prevent the independent error UI. */ }
  }
  function report(value: BookReport) {
    if (!current().active) return;
    if (value.error) { failed(value.error); return; }
    const blocked = current().availability !== "ready";
    const entering = ["preparing", "extracting", "returning"].includes(current().phase);
    set({ single: value.single, zoom: value.zoom, textures: value.textures,
      ...(!blocked && !entering ? { busy: value.busy, phase: value.busy && value.phase === "reading" ? "turning" : value.phase } : {}) });
    if (blocked || entering || value.busy || value.phase !== "reading" || !value.drawn) return;
    const page = book.pages[value.page]; if (!page) return;
    const previous = book.pages[stablePage];
    set({ page: value.page, availability: "ready", busy: false, phase: "reading" });
    if (stablePage !== value.page) {
      stablePage = value.page;
      saved = { slug: page.slug, anchor: page.anchors[0], page: value.page };
      services.save(saved);
      if (previous && previous.slug !== page.slug) services.replaceArticle(page.slug);
    }
  }
  function resolve(input: ReadingRequest) {
    const fallback = resolveReadingPage(book, input.slug, saved);
    if (fallback < 0) return fallback;
    if (!input.anchor) return fallback;
    const anchored = book.pages.find(page => (!input.slug || page.slug === input.slug) && page.anchors.includes(input.anchor!));
    if (anchored) return anchored.index;
    return book.articles.find(article => article.slug === input.slug)?.start ?? fallback;
  }
  function accepted(result: OperationResult, token: number) {
    if (token !== generation || disposed) return false;
    if (result.status === "failed") failed(result.code);
    return result.status === "completed";
  }
  async function open(value: boolean) {
    if (!current().active || current().availability !== "ready" || current().busy) return;
    const scene = services.scene(); if (!scene) { failed("当前设备无法创建三维书本。", "unsupported"); return; }
    const token = generation;
    set({ phase: value ? "opening" : "closing", busy: true });
    const result = await services.deadline(scene.openJournal(value), journalRuntime.prepareTimeoutMs, () => scene.cancelTransition());
    if (!accepted(result, token)) return;
    set({ phase: value ? "reading" : "observing", busy: false });
  }
  function intent(event: JournalIntent) {
    if (event.kind === "open" || event.kind === "close") { void open(event.kind === "open"); return; }
    if (event.kind === "turn" && current().availability === "ready" && ["reading", "turning"].includes(current().phase)) services.scene()?.turnJournal(event.direction);
  }
  async function enter(input: ReadingRequest, duration: number) {
    const token = ++generation; request = input;
    const page = resolve(input);
    set({ active: true, phase: "preparing", availability: "loading", error: "", busy: true });
    if (page < 0) { failed("这篇日记不存在或已移除。"); return; }
    if (book.availability !== "ready" || !book.pages.length) {
      const state = book.availability === "ready" ? "empty" : book.availability;
      failed(book.error ?? ({ empty: "日记尚未写下第一篇。", missing: "日记书页尚未生成。", outdated: "日记内容已更新，书页需要重新生成。" } as Record<string, string>)[state] ?? "日记书页暂不可用。", state);
      return;
    }
    const scene = services.scene();
    if (!scene?.journalAvailable()) { failed("三维书本暂不可用，请重试或返回首页。", "unsupported"); return; }
    stablePage = -1;
    set({ page });
    try {
      scene.configureJournal(book, page,
        value => { if (token === generation) report(value); },
        value => { if (token === generation) services.region(value); },
        value => { if (token === generation) intent(value); });
      scene.setJournalInteractionEnabled(false); scene.prepareJournal(false);
    } catch (cause) {
      if (token === generation && !disposed) failed(`无法准备三维书本：${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }
    set({ phase: "extracting" });
    const moved = await services.deadline(scene.moveJournal(true, duration), duration + journalRuntime.drawerDurationMs + journalRuntime.animationSlackMs, () => scene.cancelTransition());
    if (!accepted(moved, token)) return;
    set({ phase: "preparing" });
    const ready = await services.deadline(scene.journalReady(), journalRuntime.prepareTimeoutMs, () => scene.cancelTransition());
    if (!accepted(ready, token)) return;
    set({ availability: "ready", phase: "observing", busy: false });
    scene.setJournalInteractionEnabled(true);
    if (input.slug) await open(true);
  }
  return {
    $session, book, enter, intent, open,
    select(input: ReadingRequest) { return enter(input, 0); },
    failed,
    async retry() {
      if (!current().active) return;
      set({ availability: "recovering", busy: true, error: "" });
      if (!services.scene()?.journalAvailable()) await services.recovering?.();
      if (current().active && !disposed) await enter(request, 0);
    },
    async leave(duration: number) {
      const token = ++generation, scene = services.scene();
      const usable = current().availability === "ready" && !current().busy;
      const needsClosing = current().phase === "reading";
      set({ phase: "returning", busy: true });
      scene?.setJournalInteractionEnabled(false); scene?.cancelJournalPrefetch();
      if (scene && usable) {
        let canMove = true;
        if (needsClosing) {
          const closed = await services.deadline(scene.openJournal(false, true), journalRuntime.coverDurationMs + journalRuntime.animationSlackMs, () => scene.cancelTransition());
          if (token !== generation) return;
          canMove = closed.status === "completed";
        }
        if (canMove) await services.deadline(scene.moveJournal(false, duration), duration + journalRuntime.drawerDurationMs + journalRuntime.animationSlackMs, () => scene.cancelTransition());
      }
      if (token !== generation) return;
      scene?.hideJournal(); set({ active: false, phase: "stowed", busy: false });
    },
    escape() {
      if (current().availability === "ready" && current().phase === "reading" && !current().busy) void open(false);
      else services.exit();
    },
    deactivate() { generation++; services.scene()?.hideJournal(); set({ active: false, phase: "stowed", busy: false }); },
    dispose() { disposed = true; generation++; services.scene()?.hideJournal(); set({ active: false, phase: "stowed", busy: false }); },
  };
}
