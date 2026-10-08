import { subscribeActivity } from '../../../infrastructure/client/activityClient';
import { observeElementActivity } from '../../../justin-kit/runtime/elementActivity';
import { activityCopy } from '../../../application/activity/canvasActivity';

/** Reuse the canvas stream; only subscribe while the desktop profile is visible. */
export function createHomeProfile(root: HTMLElement) {
  const bubble = root.querySelector<HTMLElement>('.profile-bubble')!;
  const label = root.querySelector<HTMLElement>('[data-profile-status]')!;
  const mobile = matchMedia('(max-width: 640px)');
  let visible = false, stop: (() => void) | undefined;
  function sync() {
    const active = visible && !mobile.matches;
    root.dataset.visible = String(active);
    if (active && !stop) stop = subscribeActivity(state => {
      const now = Date.now();
      const available = state.status === 'ready' && state.snapshot !== null && state.snapshot.expiresAt > now;
      const copy = available ? activityCopy(state, now) : null;
      label.textContent = copy ? copy.detail || copy.title : '';
      label.title = label.textContent;
      bubble.hidden = !available;
    });
    if (!active && stop) { stop(); stop = undefined; }
  }
  mobile.addEventListener('change', sync);
  const stopVisibility = observeElementActivity(root, active => { visible = active; sync(); });
  return () => { stopVisibility(); mobile.removeEventListener('change', sync); stop?.(); };
}
