import type { ActivitySnapshot } from './runtime/types';
import { getBrowserActivitySource, type ActivitySource, type ActivityUpdate } from './runtime/activitySource';
import { observeElementActivity } from '../../runtime/elementActivity';
import { createDomInstances } from '../../runtime/domInstances';

function formatMeta(snapshot: ActivitySnapshot | null) {
  if (!snapshot) return 'SSE connected';
  return `${snapshot.appName} · ${new Date(snapshot.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const mounted = new WeakMap<HTMLElement, () => void>();
export function initLocalActivityStatusBadge(element: HTMLElement, suppliedSource?: ActivitySource) {
  const existing = mounted.get(element);
  if (existing) return existing;
  const text = element.querySelector<HTMLElement>('[data-activity-status-text]');
  const meta = element.querySelector<HTMLElement>('[data-activity-status-meta]');
  const source = suppliedSource ?? getBrowserActivitySource(element.dataset.streamUrl || '/api/activity/stream');
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  function update(state: ActivityUpdate) {
    const snapshot = state.status === 'ready' ? state.snapshot : null;
    element.dataset.state = state.status === 'loading' ? 'connecting' : state.status === 'error' ? 'error' : snapshot ? 'active' : 'idle';
    if (text) text.textContent = state.status === 'error' ? element.dataset.offlineText || 'Local monitor offline' :
      snapshot ? snapshot.text ?? snapshot.appName : element.dataset.idleText || 'Waiting for local monitor';
    if (meta) meta.textContent = state.status === 'error' ? 'Reconnecting' : state.status === 'loading' ? 'Connecting' : formatMeta(snapshot);
  }
  const stopActivity = observeElementActivity(element, active => {
    if (active && !unsubscribe) unsubscribe = source.subscribe(update);
    if (!active) { unsubscribe?.(); unsubscribe = undefined; }
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopActivity();
    unsubscribe?.();
    mounted.delete(element);
    delete element.dataset.localActivityBound;
  };
  mounted.set(element, dispose);
  element.dataset.localActivityBound = 'true';
  return dispose;
}

const instances = createDomInstances('[data-local-activity-status]', element => initLocalActivityStatusBadge(element));
export const initLocalActivityStatusBadges = () => instances.init();
if (typeof document !== 'undefined') initLocalActivityStatusBadges();
