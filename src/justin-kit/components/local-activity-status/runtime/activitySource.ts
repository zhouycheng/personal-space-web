import type { ActivitySnapshot } from './types';

export type ActivityUpdate =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; snapshot: ActivitySnapshot | null };
export type ActivitySource = { subscribe(listener: (state: ActivityUpdate) => void): () => void };
type Stream = Pick<EventSource, 'onopen' | 'onmessage' | 'onerror' | 'close'>;

export function parseActivitySnapshot(value: unknown): ActivitySnapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object') throw new Error('Invalid activity snapshot');
  const snapshot = value as Partial<ActivitySnapshot>;
  if (typeof snapshot.appName !== 'string' || !snapshot.appName.trim() ||
      ![snapshot.observedAt, snapshot.receivedAt, snapshot.expiresAt].every(Number.isFinite) ||
      (snapshot.text !== null && typeof snapshot.text !== 'string')) throw new Error('Invalid activity snapshot');
  return snapshot as ActivitySnapshot;
}

/** A connection exists only while at least one active consumer is subscribed. */
export function createActivitySource(open: () => Stream): ActivitySource {
  const listeners = new Set<(state: ActivityUpdate) => void>();
  let stream: Stream | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let state: ActivityUpdate = { status: 'loading' };
  const publish = (next: ActivityUpdate) => {
    state = next;
    for (const listener of listeners) listener(next);
  };
  function connect() {
    publish({ status: 'loading' });
    try {
      const connection = open();
      stream = connection;
      connection.onopen = () => { if (stream === connection) publish({ status: 'ready', snapshot: null }); };
      connection.onmessage = event => {
        if (stream !== connection) return;
        clearTimeout(expiry);
        try {
          const snapshot = parseActivitySnapshot(JSON.parse(event.data));
          const remaining = snapshot ? snapshot.expiresAt - Date.now() : 0;
          publish({ status: 'ready', snapshot: remaining > 0 ? snapshot : null });
          if (remaining > 0) expiry = setTimeout(() => publish({ status: 'ready', snapshot: null }), remaining);
        } catch { publish({ status: 'error' }); }
      };
      connection.onerror = () => {
        if (stream !== connection) return;
        clearTimeout(expiry);
        publish({ status: 'error' });
      };
    } catch { publish({ status: 'error' }); }
  }
  return {
    subscribe(listener) {
      const consumer = (next: ActivityUpdate) => listener(next);
      listeners.add(consumer);
      if (listeners.size === 1) connect();
      else listener(state);
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        listeners.delete(consumer);
        if (listeners.size) return;
        clearTimeout(expiry);
        expiry = undefined;
        const previous = stream;
        stream = undefined;
        if (previous) {
          previous.onopen = previous.onmessage = previous.onerror = null;
          previous.close();
        }
        state = { status: 'loading' };
      };
    },
  };
}

const sources = new Map<string, ActivitySource>();
export function getBrowserActivitySource(url: string): ActivitySource {
  const key = new URL(url, window.location.href).href;
  let source = sources.get(key);
  if (!source) {
    source = createActivitySource(() => new EventSource(key));
    sources.set(key, source);
  }
  return source;
}
