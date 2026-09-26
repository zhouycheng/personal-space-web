import type { ReadingAnchor } from "../../contracts/journal";

const KEY = "justin-journal-bookmark";
export function readJournalBookmark(): ReadingAnchor | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const bookmark = value as Partial<ReadingAnchor>;
    if (typeof bookmark.slug !== "string" || !Number.isInteger(bookmark.page) || bookmark.page! < 0) return null;
    return { slug: bookmark.slug, page: bookmark.page!, ...(typeof bookmark.anchor === "string" ? { anchor: bookmark.anchor } : {}) };
  } catch { return null; }
}
export function saveJournalBookmark(value: ReadingAnchor) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Session reading remains available. */ }
}
