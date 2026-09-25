import type { JournalManifest, ReadingAnchor } from "../../contracts/journal.ts";

export function spreadFor(page: number, count: number, single: boolean): number[] {
  if (!count) return [];
  const index = Math.max(0, Math.min(count - 1, Math.trunc(page) || 0));
  return single ? [index] : [index - index % 2, index - index % 2 + 1].filter(i => i < count);
}

/** A forward double-page turn carries the right face on its front and the next left face on its back. */
export function turnFaces(page: number, count: number, single: boolean, direction: 1 | -1) {
  const spread = spreadFor(page, count, single);
  if (!spread.length) return null;
  const next = single ? page + direction : spread[0] + direction * 2;
  if (next < 0 || next >= count) return null;
  return { from: page, to: next, front: single ? page : direction === 1 ? spread[0] + 1 : spread[0] - 1,
    back: single ? next : direction === 1 ? spread[0] + 2 : spread[0], direction };
}

export function resolveReadingPage(book: JournalManifest, slug?: string, saved?: ReadingAnchor | null) {
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
  try { return part ? decodeURIComponent(part) : undefined; } catch { return undefined; }
}
