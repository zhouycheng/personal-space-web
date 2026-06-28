import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveCanvasDatabasePath } from "./canvas-store.ts";

const MIME_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const ASSET_ID_PATTERN = /^[a-f0-9]{64}\.(png|jpg|webp|gif|avif)$/;

export function resolveCanvasAssetDirectory() {
  const configured = process.env.CANVAS_ASSET_DIR?.trim();
  if (configured) return path.resolve(process.cwd(), configured);
  return path.join(path.dirname(resolveCanvasDatabasePath()), "canvas-assets");
}

export function createCanvasAssetStore(root = resolveCanvasAssetDirectory()) {
  async function write(bytes: Uint8Array, mimeType: string) {
    const extension = MIME_EXTENSIONS.get(mimeType);
    if (!extension) throw new TypeError(`Unsupported canvas asset type: ${mimeType}`);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
      throw new RangeError(`Canvas asset must be between 1 byte and ${MAX_ASSET_BYTES} bytes`);
    }
    await mkdir(root, { recursive: true });
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const id = `${checksum}.${extension}`;
    const filePath = path.join(root, id);
    try {
      const handle = await open(filePath, "wx", 0o600);
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    }
    return {
      id,
      url: `/api/canvas/assets/${id}`,
      mimeType,
      size: bytes.byteLength,
      checksum,
      path: filePath,
    };
  }

  async function read(id: string) {
    if (!ASSET_ID_PATTERN.test(id)) throw new TypeError("Invalid asset identifier");
    const extension = id.slice(id.lastIndexOf(".") + 1);
    const mimeType = [...MIME_EXTENSIONS].find(([, ext]) => ext === extension)?.[0];
    if (!mimeType) throw new TypeError("Invalid asset identifier");
    const filePath = path.join(root, id);
    return { bytes: await readFile(filePath), mimeType, path: filePath };
  }

  return { write, read, root };
}

let singleton: ReturnType<typeof createCanvasAssetStore> | null = null;

export function getCanvasAssetStore() {
  singleton ??= createCanvasAssetStore();
  return singleton;
}
