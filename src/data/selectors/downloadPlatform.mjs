export const DOWNLOAD_PLATFORMS = Object.freeze({
  macos: "macos",
  windows: "windows",
  unsupported: "unsupported",
});

export function detectDownloadPlatform(environment = {}) {
  const userAgentDataPlatform = String(environment.userAgentDataPlatform || "").toLowerCase();
  const platform = String(environment.platform || "").toLowerCase();
  const userAgent = String(environment.userAgent || "").toLowerCase();
  const maxTouchPoints = Number(environment.maxTouchPoints || 0);

  const isMobilePlatform = /iphone|ipad|ipod|android/.test(userAgent);
  const isDesktopModeIPad = platform.includes("mac") && maxTouchPoints > 1;
  if (isMobilePlatform || isDesktopModeIPad) return DOWNLOAD_PLATFORMS.unsupported;

  const reportedPlatform = userAgentDataPlatform || platform;
  if (reportedPlatform.includes("win") || userAgent.includes("windows")) {
    return DOWNLOAD_PLATFORMS.windows;
  }

  if (reportedPlatform.includes("mac") || /macintosh|mac os x/.test(userAgent)) {
    return DOWNLOAD_PLATFORMS.macos;
  }

  return DOWNLOAD_PLATFORMS.unsupported;
}

export function selectDefaultDownload(packages, platform) {
  if (!Array.isArray(packages) || platform === DOWNLOAD_PLATFORMS.unsupported) return null;
  const platformPackages = packages.filter((item) => item?.platform === platform);
  return platformPackages.find((item) => item.defaultForPlatform) || platformPackages[0] || null;
}
