import type { JournalManifest, ReadingAnchor } from "../../contracts/journal.ts";

export function resolveReadingPage(book: JournalManifest, slug?: string, saved?: ReadingAnchor | null) {
  if (slug && !book.articles.some(article => article.slug === slug)) return -1;
  const article = book.articles.find(a => a.slug === slug) ?? (!slug ? book.articles.find(a => a.slug === saved?.slug) : undefined) ?? book.articles.at(-1);
  if (!article) return 0;
  if (saved?.slug === article.slug) {
    const anchored = saved.anchor && book.pages.find(p => p.slug === article.slug && p.anchors.includes(saved.anchor!));
    if (anchored) return anchored.index;
    if (Number.isFinite(saved.page)) return Math.max(article.start, Math.min(article.start + article.count - 1, saved.page));
  }
  return article.start;
}

export function journalSlug(path: string) {
  const part = path.replace(/\/+$/, "").match(/^\/journal\/([^/]+)$/)?.[1];
  try { return part ? decodeURIComponent(part) : undefined; } catch { return part; }
}
