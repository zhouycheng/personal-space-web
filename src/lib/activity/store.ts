import { resolveActivityText } from "./catalog";
import type { ActivitySnapshot, ActivityUpdatePayload } from "./types";

export const DEFAULT_ACTIVITY_TTL_MS = 25_000;

type ActivityListener = (snapshot: ActivitySnapshot | null) => void;

class ActivityStatusStore {
  private current: ActivitySnapshot | null = null;
  private readonly listeners = new Set<ActivityListener>();
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  getSnapshot(): ActivitySnapshot | null {
    if (this.current && this.current.expiresAt <= Date.now()) {
      this.clear();
    }

    return this.current;
  }

  update(payload: ActivityUpdatePayload, ttlMs: number = DEFAULT_ACTIVITY_TTL_MS): ActivitySnapshot | null {
    if (payload.state !== "active" || !payload.appName) {
      this.clear();
      return null;
    }

    const text = resolveActivityText(payload.appName);
    if (!text) {
      this.clear();
      return null;
    }

    const receivedAt = Date.now();
    const snapshot: ActivitySnapshot = {
      appName: payload.appName,
      text,
      observedAt: payload.observedAt ?? receivedAt,
      receivedAt,
      expiresAt: receivedAt + ttlMs,
      sessionId: payload.sessionId ?? null,
    };

    this.current = snapshot;
    this.scheduleExpiry(snapshot.expiresAt);
    this.emit(snapshot);
    return snapshot;
  }

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.current = null;

    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    this.emit(null);
  }

  private emit(snapshot: ActivitySnapshot | null): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private scheduleExpiry(expiresAt: number): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }

    this.expiryTimer = setTimeout(() => {
      this.clear();
    }, Math.max(0, expiresAt - Date.now()));

    this.expiryTimer.unref?.();
  }
}

const instance = new ActivityStatusStore();

export function getActivityStore(): ActivityStatusStore {
  return instance;
}
