import generated from "../../generated/journal.json";
import type { JournalManifest } from "../../contracts/journal";
export const journal = generated as JournalManifest;
export const articlePath = (slug: string) => `/journal/${encodeURIComponent(slug)}`;
