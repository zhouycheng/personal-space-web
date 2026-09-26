import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { JournalAvailability, JournalManifest, JournalPackageManifest } from "../../contracts/journal";

export type JournalPackageHealth = {
  ok: boolean;
  availability: JournalAvailability;
  renderHash: string | null;
  articles: number;
  pages: number;
  error?: string;
};

type HealthOptions = {
  directory?: string;
  production?: boolean;
  expected?: Pick<JournalManifest, "renderHash" | "availability">;
};

const digest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Runtime-only health check: no source tree, Chromium, image codec or dev dependency. */
export async function inspectJournalPackage(options: HealthOptions = {}): Promise<JournalPackageHealth> {
  let renderHash: string | null = null;
  try {
    if (options.expected && !["ready", "empty"].includes(options.expected.availability)) {
      return { ok: false, availability: options.expected.availability, renderHash: null, articles: 0, pages: 0, error: "Journal is not ready" };
    }
    const production = options.production ?? process.env.NODE_ENV === "production";
    const root = path.resolve(options.directory ?? (production ? "dist/client/journal/generated" : "public/journal/generated"));
    const pointer: { version: number; renderHash: string; manifestSha256: string } = JSON.parse(await readFile(path.join(root, "current.json"), "utf8"));
    if (pointer.version !== 1 || !/^[a-f0-9]{20}$/.test(pointer.renderHash) || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) throw new Error("Invalid journal activation pointer");
    renderHash = pointer.renderHash;
    if (options.expected && options.expected.renderHash !== renderHash) return { ok: false, availability: "outdated", renderHash, articles: 0, pages: 0, error: "Journal runtime and package versions differ" };
    const directory = await realpath(path.join(root, renderHash));
    if (!directory.startsWith(await realpath(root) + path.sep)) throw new Error("Journal version path escapes output");
    const bytes = await readFile(path.join(directory, "manifest.json"));
    if (digest(bytes) !== pointer.manifestSha256) throw new Error("Journal manifest checksum mismatch");
    const manifest: JournalPackageManifest = JSON.parse(bytes.toString("utf8"));
    if (manifest.version !== 2 || manifest.renderHash !== renderHash || !["ready", "empty"].includes(manifest.availability) || !Array.isArray(manifest.articles) || !Array.isArray(manifest.pages) || !manifest.files) throw new Error("Invalid journal manifest");
    if ((manifest.articles.length === 0) !== (manifest.pages.length === 0) || (manifest.pages.length === 0) !== (manifest.availability === "empty")) throw new Error("Invalid journal empty state");
    if (Object.keys(manifest.files).length !== manifest.pages.length * 2) throw new Error("Incomplete journal resource inventory");
    for (let index = 0; index < manifest.pages.length; index++) {
      for (const [kind, field] of [["pages", "image"], ["thumbnails", "thumbnail"]] as const) {
        const relative = `${kind}/${index}.webp`;
        if (manifest.pages[index][field] !== `/journal/generated/${renderHash}/${relative}`) throw new Error("Invalid journal resource mapping");
        const record = manifest.files[relative];
        if (!record || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error("Missing journal resource checksum");
        const resource = await realpath(path.join(directory, relative));
        if (!resource.startsWith(directory + path.sep)) throw new Error("Journal resource escapes package");
        const image = await readFile(resource);
        if (image.length !== record.bytes || digest(image) !== record.sha256) throw new Error("Journal resource checksum mismatch");
      }
    }
    return { ok: true, availability: manifest.availability, renderHash, articles: manifest.articles.length, pages: manifest.pages.length };
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    return { ok: false, availability: missing ? "missing" : "error", renderHash, articles: 0, pages: 0,
      error: error instanceof Error ? error.message : "Journal package check failed" };
  }
}
