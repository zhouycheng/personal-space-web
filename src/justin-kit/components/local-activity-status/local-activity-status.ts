import type { ActivitySnapshot } from "./runtime/types";

function formatMeta(snapshot: ActivitySnapshot | null) {
  if (!snapshot) {
    return "SSE connected";
  }

  const observedAt = new Date(snapshot.observedAt);
  return `${snapshot.appName} · ${observedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function initLocalActivityStatusBadge(element: HTMLElement) {
  if (element.dataset.localActivityBound === "true") {
    return () => {};
  }

  element.dataset.localActivityBound = "true";

  const textElement = element.querySelector<HTMLElement>("[data-activity-status-text]");
  const metaElement = element.querySelector<HTMLElement>("[data-activity-status-meta]");
  const streamUrl = element.dataset.streamUrl || "/api/activity/stream";
  const idleText = element.dataset.idleText || "Waiting for local monitor";
  const offlineText = element.dataset.offlineText || "Local monitor offline";
  let source: EventSource | null = null;

  const setState = (state: "connecting" | "active" | "idle" | "error", text: string, meta: string) => {
    element.dataset.state = state;
    if (textElement) textElement.textContent = text;
    if (metaElement) metaElement.textContent = meta;
  };

  try {
    source = new EventSource(streamUrl);
  } catch {
    setState("error", offlineText, "EventSource unavailable");
    return () => {};
  }

  source.onopen = () => {
    setState("idle", idleText, "SSE connected");
  };

  source.onmessage = (event) => {
    try {
      const snapshot = JSON.parse(event.data) as ActivitySnapshot | null;
      if (!snapshot) {
        setState("idle", idleText, formatMeta(null));
        return;
      }

      setState("active", snapshot.text, formatMeta(snapshot));
    } catch {
      setState("error", offlineText, "Malformed activity event");
    }
  };

  source.onerror = () => {
    setState("error", offlineText, "Reconnecting");
  };

  return () => {
    source?.close();
    delete element.dataset.localActivityBound;
  };
}

export function initLocalActivityStatusBadges() {
  document
    .querySelectorAll<HTMLElement>("[data-local-activity-status]")
    .forEach((element) => initLocalActivityStatusBadge(element));
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLocalActivityStatusBadges, { once: true });
  } else {
    initLocalActivityStatusBadges();
  }
}
