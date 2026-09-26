import type { ScenePort } from "../contracts/studioPorts";
import type { JournalManifest } from "../contracts/journal";
import { journalSlug } from "../application/journal/book-state";
import { createJournalController } from "../application/journal/readerController";
import { readJournalBookmark, saveJournalBookmark } from "../infrastructure/client/journalBookmark";
import { withActiveDeadline } from "../infrastructure/client/activeDeadline";
import { bindJournalReader } from "../presentation/ui/journal/journalRuntime";
import { siteIdentity } from "../data/repositories/siteIdentity";
import { articleTitle } from "../data/selectors/siteIdentity";

export function createJournalReader(root: HTMLElement, scene: () => ScenePort | undefined, navigate: (path: string) => void, recover?: () => Promise<void>) {
  const book = JSON.parse(root.querySelector('[data-journal-manifest]')!.textContent!) as JournalManifest;
  const controller = createJournalController(book, {
    scene, saved: readJournalBookmark(), save: saveJournalBookmark,
    region: region => binding.openRegion(region),
    replaceArticle(slug) { history.replaceState(history.state, '', `/journal/${encodeURIComponent(slug)}`); },
    exit() { root.querySelector<HTMLAnchorElement>('[data-journal-close]')!.click(); },
    recovering: recover, deadline: withActiveDeadline,
  });
  const binding = bindJournalReader(root, book, controller, scene, navigate, title => articleTitle(siteIdentity, title));
  function request(path: string) {
    const url = new URL(path, location.origin);
    let anchor = "";
    try { anchor = decodeURIComponent(url.hash.slice(1)); } catch { /* Invalid fragments use the article start. */ }
    return { slug: journalSlug(url.pathname), anchor };
  }
  return {
    book,
    enter(path: string, duration: number) { return controller.enter(request(path), duration); },
    fallback(message = "三维书本暂不可用，请重试或返回首页。") { controller.failed(message, "unsupported"); },
    select(path: string) { return controller.select(request(path)); },
    async leave(duration: number) { binding.closeImage(); await controller.leave(duration); },
    deactivate() { binding.closeImage(); controller.deactivate(); },
    dispose() { binding.dispose(); controller.dispose(); },
  };
}
