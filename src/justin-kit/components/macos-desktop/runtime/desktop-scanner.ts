import { readdir } from "node:fs/promises";
import path from "node:path";
import type { DesktopEntry, DesktopFileKind, DesktopIconVariant } from "./types";

const DEFAULT_DESKTOP_DIR = "public/os-desktop";
const SUPPORTED_EXTENSIONS = new Set([".html", ".md"]);

type ScanOptions = {
  desktopDir?: string;
  publicBasePath?: string;
};

export async function getMacOsDesktopEntries(options: ScanOptions = {}): Promise<DesktopEntry[]> {
  const desktopDir = options.desktopDir ?? DEFAULT_DESKTOP_DIR;
  const publicBasePath = options.publicBasePath ?? "/os-desktop";
  const absoluteRoot = path.resolve(process.cwd(), desktopDir);

  try {
    return await scanDirectory(absoluteRoot, "", publicBasePath);
  } catch (error) {
    if (isMissingDirectoryError(error)) return [];
    throw error;
  }
}

async function scanDirectory(root: string, relativeDir: string, publicBasePath: string): Promise<DesktopEntry[]> {
  const absoluteDir = path.join(root, relativeDir);
  const dirents = await readdir(absoluteDir, { withFileTypes: true });
  const entries: DesktopEntry[] = [];

  for (const dirent of dirents) {
    if (shouldIgnoreName(dirent.name)) continue;

    const relativePath = path.join(relativeDir, dirent.name);
    const extension = dirent.isDirectory() ? "" : path.extname(dirent.name).toLowerCase();

    if (dirent.isDirectory()) {
      const children = await scanDirectory(root, relativePath, publicBasePath);
      entries.push(createFolderEntry(relativePath, dirent.name, children));
      continue;
    }

    if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
    entries.push(createFileEntry(relativePath, dirent.name, extension, publicBasePath));
  }

  return entries.sort(compareDesktopEntries);
}

function createFolderEntry(relativePath: string, name: string, children: DesktopEntry[]): DesktopEntry {
  const title = name;

  return {
    id: makeEntryId(relativePath),
    title,
    kind: "folder",
    icon: "folder",
    window: {
      title,
      renderer: "folder",
      width: 740,
      height: 480,
      minWidth: 420,
      minHeight: 320,
    },
    children,
  };
}

function createFileEntry(relativePath: string, name: string, extension: string, publicBasePath: string): DesktopEntry {
  const title = path.basename(name, extension);
  const kind = extension === ".html" ? "html" : "markdown";

  return {
    id: makeEntryId(relativePath),
    title,
    kind,
    icon: kind,
    window: {
      title,
      renderer: kind,
      width: kind === "html" ? 760 : 680,
      height: kind === "html" ? 540 : 520,
      minWidth: kind === "html" ? 420 : 380,
      minHeight: 320,
      contentUrl: toPublicUrl(publicBasePath, relativePath),
    },
  };
}

function shouldIgnoreName(name: string) {
  return name.startsWith(".") || name === "__MACOSX";
}

function makeEntryId(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function toPublicUrl(publicBasePath: string, relativePath: string) {
  const encodedPath = relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${publicBasePath.replace(/\/$/, "")}/${encodedPath}`;
}

function compareDesktopEntries(a: DesktopEntry, b: DesktopEntry) {
  if (a.kind === "folder" && b.kind !== "folder") return -1;
  if (a.kind !== "folder" && b.kind === "folder") return 1;
  return a.title.localeCompare(b.title, "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function isMissingDirectoryError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT",
  );
}
