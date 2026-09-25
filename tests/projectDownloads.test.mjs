import assert from "node:assert/strict";
import test from "node:test";

import {
  DOWNLOAD_PLATFORMS,
  detectDownloadPlatform,
  selectDefaultDownload,
} from "../src/data/selectors/downloadPlatform.mjs";

test("download platform detection matches supported desktop systems", () => {
  assert.equal(
    detectDownloadPlatform({ userAgentDataPlatform: "macOS" }),
    DOWNLOAD_PLATFORMS.macos,
  );
  assert.equal(
    detectDownloadPlatform({ userAgentDataPlatform: "Windows" }),
    DOWNLOAD_PLATFORMS.windows,
  );
  assert.equal(
    detectDownloadPlatform({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }),
    DOWNLOAD_PLATFORMS.windows,
  );
});

test("download platform detection avoids unsupported mobile and Linux packages", () => {
  assert.equal(
    detectDownloadPlatform({
      platform: "iPhone",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)",
    }),
    DOWNLOAD_PLATFORMS.unsupported,
  );
  assert.equal(
    detectDownloadPlatform({
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      maxTouchPoints: 5,
    }),
    DOWNLOAD_PLATFORMS.unsupported,
  );
  assert.equal(
    detectDownloadPlatform({
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    }),
    DOWNLOAD_PLATFORMS.unsupported,
  );
  assert.equal(
    detectDownloadPlatform({ platform: "Linux x86_64" }),
    DOWNLOAD_PLATFORMS.unsupported,
  );
  assert.equal(detectDownloadPlatform(), DOWNLOAD_PLATFORMS.unsupported);
});

test("default download selection prefers the marked package for the detected platform", () => {
  const packages = [
    { id: "windows-portable", platform: "windows" },
    { id: "macos-dmg", platform: "macos", defaultForPlatform: true },
    { id: "windows-setup", platform: "windows", defaultForPlatform: true },
  ];

  assert.equal(selectDefaultDownload(packages, DOWNLOAD_PLATFORMS.macos)?.id, "macos-dmg");
  assert.equal(selectDefaultDownload(packages, DOWNLOAD_PLATFORMS.windows)?.id, "windows-setup");
  assert.equal(selectDefaultDownload(packages, DOWNLOAD_PLATFORMS.unsupported), null);
  assert.equal(selectDefaultDownload([], DOWNLOAD_PLATFORMS.windows), null);
});
