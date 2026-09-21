export type JournalRegion = { kind: "link" | "image"; href: string; label: string; x: number; y: number; width: number; height: number };
export type JournalPage = { index: number; slug: string; image: string; thumbnail: string; anchors: string[]; text: string; regions: JournalRegion[] };
export type JournalArticle = { slug: string; title: string; description: string; date: string; html: string; start: number; count: number };
export type JournalManifest = { version: 1; hash: string; width: number; height: number; articles: JournalArticle[]; pages: JournalPage[] };
export type ReadingAnchor = { slug: string; anchor?: string; page: number };
