export type AppPage = "home" | "works" | "os" | "canvas";

export const NAV_ITEMS = [
  { page: "home", path: "/home", number: "01", label: "首页" },
  { page: "works", path: "/works", number: "02", label: "文件夹" },
  { page: "canvas", path: "/canvas", number: "03", label: "我的画布" },
  { page: "os", path: "/os", number: "04", label: "Justin OS" },
] as const satisfies ReadonlyArray<{
  page: AppPage;
  path: string;
  number: string;
  label: string;
}>;

export const PAGE_TITLES: Record<AppPage, string> = {
  home: "Justin OS",
  works: "Justin OS - 文件夹",
  os: "Justin OS",
  canvas: "Justin OS - 我的画布",
};

export function normalizeAppPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function isAppPage(value: unknown): value is AppPage {
  return value === "home" || value === "works" || value === "os" || value === "canvas";
}

export function studioStateForPage(page: AppPage) {
  return page === "os" ? "desktop" : page === "canvas" ? "canvas" : "room";
}

// Return through an entry created by this router; never guess the previous URL.
export function historyAction(current: AppPage, next: AppPage, entry: unknown): "none" | "back" | "replace" | "push" {
  if (current === next) return "none";
  if (next !== "home") return "push";
  if (entry && typeof entry === "object" && "justinPage" in entry && "from" in entry && entry.justinPage === current && entry.from === "home") return "back";
  return "replace";
}

export function pageForPath(pathname: string): AppPage {
  const normalized = normalizeAppPath(pathname);
  if (normalized === "/") return "home";
  return NAV_ITEMS.find((item) => item.path === normalized)?.page ?? "home";
}
