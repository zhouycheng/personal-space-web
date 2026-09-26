export type JournalRegion = { kind: "link" | "image"; href: string; label: string; x: number; y: number; width: number; height: number };
export type JournalPage = { index: number; slug: string; image: string; thumbnail: string; imageWidth: number; imageHeight: number; anchors: string[]; regions: JournalRegion[] };
export type JournalArticle = { slug: string; title: string; description: string; date: string; start: number; count: number };
export type JournalAvailability = "ready" | "empty" | "missing" | "outdated" | "error" | "loading" | "recovering" | "unsupported";
export type JournalManifest = {
  version: 2; hash: string; renderHash: string; contentHash: string;
  width: number; height: number; availability: JournalAvailability; error?: string;
  articles: JournalArticle[]; pages: JournalPage[];
};
export type JournalPackageManifest = JournalManifest & {
  environment: { node: string; playwright: string; browserRevision: string; platform: string; arch: string; channel: string };
  files: Record<string, { sha256: string; bytes: number; width: number; height: number }>;
};
export type ReadingAnchor = { slug: string; anchor?: string; page: number };
export type JournalPhase = "stowed" | "preparing" | "extracting" | "observing" | "opening" | "reading" | "turning" | "closing" | "returning";
export type JournalBookPhase = "observing" | "opening" | "reading" | "closing";
export type BookReport = {
  page: number; single: boolean; busy: boolean; error: string; textures: number;
  phase: JournalBookPhase; zoom: number; drawn: boolean;
  textureBytes: number; decodeBytes: number;
};
export type JournalIntent = { kind: "open" | "close" } | { kind: "turn"; direction: 1 | -1 };
export type JournalSession = {
  active: boolean; phase: JournalPhase; availability: JournalAvailability; error: string;
  page: number; single: boolean; zoom: number; busy: boolean; textures: number;
};
