import generated from "../../generated/journal.json";
import type { JournalManifest } from "../../contracts/journal";
// The build integration validates the activated immutable package before this
// projection is bundled. Production needs neither source files nor the generator.
const runtime = generated as JournalManifest;
if (runtime.version !== 2 || !Array.isArray(runtime.articles) || !Array.isArray(runtime.pages)) {
  throw new Error("Invalid generated journal runtime; run journal:verify");
}
export const journal: JournalManifest = runtime;
export const articlePath = (slug: string) => `/journal/${encodeURIComponent(slug)}`;
