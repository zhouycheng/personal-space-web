import type { ScenePort } from "../../../contracts/studioPorts";
import type { JournalManifest, JournalRegion, JournalSession } from "../../../contracts/journal";
import type { createJournalController } from "../../../application/journal/readerController";
import { spreadFor } from "../../../data/selectors/journalPages";

export function bindJournalReader(root: HTMLElement, book: JournalManifest, controller: ReturnType<typeof createJournalController>, scene: () => ScenePort | undefined, navigate: (path: string) => void, formatTitle: (title: string) => string) {
  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const status = q('[data-journal-status]'), image = q<HTMLDialogElement>('[data-journal-image]');
  const events = new AbortController();
  function syncInteraction() {
    const state = controller.$session.get();
    scene()?.setJournalInteractionEnabled(state.active && state.availability === "ready" && !image.open);
  }
  function update(state: JournalSession) {
    const { page, phase, busy, zoom, single, availability, error } = state;
    root.dataset.phase = phase; root.dataset.availability = availability;
    root.classList.toggle("is-zoomed", zoom > 1.05);
    const visible = spreadFor(page, book.pages.length, single), reading = phase === "reading" || phase === "turning";
    const usable = availability === "ready";
    const retryable = ["error", "unsupported"].includes(availability);
    const article = book.articles.find(article => article.slug === book.pages[page]?.slug);
    q('[data-journal-title]').textContent = article?.title ?? "日记";
    if (state.active && article) document.title = formatTitle(article.title);
    q('output').textContent = book.pages.length ? visible.map(index => index + 1).join('–') + ` / ${book.pages.length}` : '—';
    for (const selector of ['output', '[data-journal-fold]']) q(selector).hidden = !reading || !usable;
    const controls = q('.journal-controls');
    controls.hidden = !(reading && usable) && !retryable;
    controls.inert = reading && usable && zoom > 1.05;
    q<HTMLButtonElement>('[data-journal-fold]').disabled = busy || !usable;
    const hint = q('[data-journal-hint]');
    hint.hidden = !usable || busy;
    hint.textContent = reading ? (single?'点击两侧移动视角 · 看完双页后继续翻页':'点击书页翻页 · 拖动调整视角 · 滚轮缩放') : '点击封面打开 · 拖动调整视角';
    for(const direction of [-1,1]){
      const button=q<HTMLButtonElement>(`[data-journal-direction="${direction}"]`);
      button.hidden=!single||!reading||!usable||zoom>1.05;
      button.disabled=busy||page+direction<0||page+direction>=book.pages.length;
      button.setAttribute('aria-label',direction===1?(page%2===0?'查看右页':'翻到下一页'):(page%2===1?'查看左页':'翻到上一页'));
    }
    status.hidden = (usable || phase === "extracting" || phase === "returning") && !error;
    status.textContent = error || (availability === "recovering" ? "正在恢复三维日记…" : "正在准备日记书页…");
    q('[data-journal-retry]').hidden = !retryable;
    syncInteraction();
  }
  function openRegion(item: JournalRegion) {
    if (item.kind === "image") {
      const target = q<HTMLImageElement>('[data-journal-image] > img');
      target.src = item.href; target.alt = item.label; image.showModal(); syncInteraction(); return;
    }
    const url = new URL(item.href, location.href);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return;
    if (url.origin === location.origin && url.pathname.startsWith('/journal')) navigate(url.pathname + url.hash);
    else window.open(url.href, '_blank', 'noopener,noreferrer');
  }
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('button,a'); if (!target) return;
    if (target.matches('[data-journal-retry]')) void controller.retry();
    if (target.matches('[data-journal-fold]')) void controller.open(false);
    if(target.matches('[data-journal-direction]'))controller.intent({kind:'turn',direction:target.dataset.journalDirection==='1'?1:-1});
    if (target.matches('[data-journal-image-close]')) image.close();
  }, { signal: events.signal });
  image.addEventListener('close', () => {
    q<HTMLImageElement>('[data-journal-image] > img').removeAttribute('src'); syncInteraction();
  }, { signal: events.signal });
  window.addEventListener('keydown', event => {
    const state = controller.$session.get();
    if (!state.active || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (image.open) image.close();
      else controller.escape();
      return;
    }
    if (image.open || state.availability !== "ready") return;
    if (state.phase === "observing" && (event.key === "Enter" || event.key === " ") && event.target instanceof HTMLCanvasElement) {
      event.preventDefault(); void controller.open(true); return;
    }
    if (!["reading", "turning"].includes(state.phase)) return;
    if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault(); controller.intent({ kind: "turn", direction: event.key === "ArrowRight" || event.key === "PageDown" ? 1 : -1 });
    }
    if (state.busy) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); scene()?.zoomJournal(state.zoom + .25); }
    if (event.key === "-") { event.preventDefault(); scene()?.zoomJournal(state.zoom - .25); }
    if (event.key === "0" || event.key === "Home") { event.preventDefault(); scene()?.resetJournal(); }
  }, { signal: events.signal });
  const unsubscribe = controller.$session.subscribe(update);
  return {
    openRegion,
    closeImage() { image.close(); },
    dispose() { events.abort(); unsubscribe(); image.close(); },
  };
}
