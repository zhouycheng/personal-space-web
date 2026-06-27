#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

const MONITOR_BASE = (process.env.ACTIVITY_MONITOR_URL ?? "http://localhost:4321").replace(/\/$/, "");
const MONITOR_TOKEN = process.env.ACTIVITY_MONITOR_TOKEN;

function resolveUpdateUrls() {
  const urls = [`${MONITOR_BASE}/api/activity/update`];
  const extra = process.env.ACTIVITY_MONITOR_EXTRA_URLS;
  if (extra) {
    for (const url of extra.split(",")) {
      const trimmed = url.trim().replace(/\/$/, "");
      if (trimmed) urls.push(`${trimmed}/api/activity/update`);
    }
  }
  return urls;
}

const UPDATE_URLS = resolveUpdateUrls();

const POLL_INTERVAL_MS = Number(process.env.ACTIVITY_MONITOR_POLL_INTERVAL_MS ?? 2_000);
const HEARTBEAT_INTERVAL_MS = Number(
  process.env.ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS ?? 12_000
);
const REQUEST_TIMEOUT_MS = Number(
  process.env.ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS ?? 4_000
);

if (!MONITOR_TOKEN) {
  console.error("[activity-monitor] ACTIVITY_MONITOR_TOKEN is required.");
  console.error(
    "[activity-monitor] Add ACTIVITY_MONITOR_TOKEN to .env.local, then restart `npm run dev`."
  );
  process.exit(1);
}

const SESSION_ID = randomUUID();

let shuttingDown = false;
let lastFingerprint = "";
let lastSentAt = 0;

const APPLE_SCRIPT = `
try
  tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set localizedName to displayed name of frontApp
    if localizedName is "" then set localizedName to name of frontApp
    set visibleWindowCount to 0
    try
      set visibleWindowCount to count of windows of frontApp
    end try
    return localizedName & "||" & (visibleWindowCount as string)
  end tell
on error errMsg
  return "__ERROR__||" & (errMsg as string)
end try
`;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readForegroundActivity() {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", APPLE_SCRIPT], {
    timeout: 3_000,
  });

  const output = stdout.trim();
  if (output.startsWith("__ERROR__||")) {
    const message = output.slice("__ERROR__||".length).trim();
    throw new Error(
      `osascript failed${message ? `: ${message}` : ""}. Check macOS Accessibility permissions.`
    );
  }

  const [rawAppName = ""] = output.split("||");
  const appName = rawAppName.trim() || null;

  return {
    appName,
    // Some macOS apps report zero visible windows even when they are frontmost.
    // Treat any detected frontmost app as active so the website reflects real usage.
    state: appName ? "active" : "inactive",
    observedAt: Date.now(),
  };
}

async function readResponseBody(response) {
  try {
    const text = await response.text();
    if (!text) {
      return { json: null, text: "" };
    }

    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null, text };
    }
  } catch {
    return { json: null, text: "" };
  }
}

async function pushToUrl(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MONITOR_TOKEN}`,
      },
      body: JSON.stringify({
        ...payload,
        sessionId: SESSION_ID,
      }),
      signal: controller.signal,
    });

    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${body.text ? `: ${body.text}` : ""}`);
    }

    return body.json;
  } finally {
    clearTimeout(timeout);
  }
}

async function pushActivity(payload) {
  let primaryResult = null;
  for (const url of UPDATE_URLS) {
    try {
      const result = await pushToUrl(url, payload);
      if (url === UPDATE_URLS[0]) primaryResult = result;
    } catch (error) {
      const label = url === UPDATE_URLS[0] ? "[primary]" : "[extra]";
      console.error(`[activity-monitor] ${label} push failed (${url}):`, error.message);
    }
  }
  return primaryResult;
}

async function sendInactiveAndExit(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await pushActivity({
      appName: null,
      state: "inactive",
      observedAt: Date.now(),
    });
  } catch (error) {
    console.error("[activity-monitor] failed to publish inactive state:", error);
  } finally {
    console.log(`[activity-monitor] stopped (${signal}).`);
    process.exit(0);
  }
}

async function tick() {
  const activity = await readForegroundActivity();
  const fingerprint = `${activity.state}:${activity.appName ?? ""}`;
  const now = Date.now();
  const changed = fingerprint !== lastFingerprint;
  const dueHeartbeat = now - lastSentAt >= HEARTBEAT_INTERVAL_MS;

  if (!changed && !dueHeartbeat) {
    return;
  }

  const result = await pushActivity(activity);

  lastFingerprint = fingerprint;
  lastSentAt = now;

  if (activity.state === "active" && activity.appName && result?.active === false) {
    console.log(
      `[activity-monitor] active -> ${activity.appName} (not shown; add it to runtime/catalog.ts)`
    );
    return;
  }

  console.log(
    `[activity-monitor] ${activity.state}${activity.appName ? ` -> ${activity.appName}` : ""}`
  );
}

async function run() {
  console.log(`[activity-monitor] session ${SESSION_ID}`);
  for (const url of UPDATE_URLS) {
    const label = url === UPDATE_URLS[0] ? "primary" : "extra";
    console.log(`[activity-monitor] [${label}] posting to ${url}`);
  }

  while (!shuttingDown) {
    const startedAt = Date.now();

    try {
      await tick();
    } catch (error) {
      console.error("[activity-monitor] tick failed:", error);
    }

    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(250, POLL_INTERVAL_MS - elapsed));
  }
}

process.on("SIGINT", () => {
  void sendInactiveAndExit("SIGINT");
});

process.on("SIGTERM", () => {
  void sendInactiveAndExit("SIGTERM");
});

void run();
