import { detectDownloadPlatform, selectDefaultDownload } from "../../../data/selectors/downloadPlatform.mjs";

type DownloadData = {
  version?: string;
  packages: Parameters<typeof selectDefaultDownload>[0];
};

for (const root of document.querySelectorAll<HTMLElement>("[data-project-download]")) {
  if (root.dataset.downloadReady === "true") continue;
  const primary = root.querySelector<HTMLButtonElement>("[data-download-primary]");
  const toggle = root.querySelector<HTMLButtonElement>("[data-download-toggle]");
  const label = root.querySelector<HTMLElement>("[data-download-label]");
  const menu = root.querySelector<HTMLElement>("[data-download-menu]");
  const dataElement = root.querySelector<HTMLScriptElement>("[data-download-data]");
  if (!primary || !toggle || !label || !menu || !dataElement) continue;
  root.dataset.downloadReady = "true";

  let downloads: DownloadData;
  try {
    downloads = JSON.parse(dataElement.textContent || "{}") as DownloadData;
    if (!Array.isArray(downloads.packages)) downloads.packages = [];
  } catch {
    downloads = { packages: [] };
  }

  const platform = detectDownloadPlatform({
    userAgentDataPlatform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform,
    platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.userAgent,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const defaultDownload = selectDefaultDownload(downloads.packages, platform);
  if (defaultDownload) {
    label.textContent = platform === "macos" ? "下载 macOS" : "下载 Windows";
    primary.dataset.downloadHref = defaultDownload.href;
    primary.setAttribute("aria-label", `${label.textContent}，FrameLean v${downloads.version}`);
    primary.removeAttribute("aria-haspopup");
    primary.removeAttribute("aria-expanded");
    primary.removeAttribute("aria-controls");
  } else {
    label.textContent = "选择下载";
    primary.setAttribute("aria-label", "选择 FrameLean 下载版本");
  }

  function setOpen(open: boolean) {
    menu!.hidden = !open;
    root.classList.toggle("is-open", open);
    if (!primary!.dataset.downloadHref) primary!.setAttribute("aria-expanded", String(open));
    toggle!.setAttribute("aria-expanded", String(open));
  }

  primary.addEventListener("click", () => {
    const href = primary.dataset.downloadHref;
    if (href) window.location.assign(href);
    else setOpen(menu.hidden);
  });
  toggle.addEventListener("click", () => setOpen(menu.hidden));
  menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("click", event => {
    if (!menu.hidden && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || menu.hidden) return;
    setOpen(false);
    toggle.focus();
  });
}
