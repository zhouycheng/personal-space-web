export type AppPage = "home" | "works" | "os";

export const NAV_ITEMS = [
  { page: "home", path: "/home", number: "01", label: "首页" },
  { page: "works", path: "/works", number: "02", label: "作品集" },
  { page: "os", path: "/os", number: "03", label: "我的" },
] as const satisfies ReadonlyArray<{
  page: AppPage;
  path: string;
  number: string;
  label: string;
}>;

export const PAGE_TITLES: Record<AppPage, string> = {
  home: "Justin OS",
  works: "Justin OS - 作品集",
  os: "Justin OS - 我的",
};

export function normalizeAppPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function isAppPage(value: unknown): value is AppPage {
  return value === "home" || value === "works" || value === "os";
}

export function pageForPath(pathname: string): AppPage {
  const normalized = normalizeAppPath(pathname);
  if (normalized === "/") return "home";
  return NAV_ITEMS.find((item) => item.path === normalized)?.page ?? "home";
}
