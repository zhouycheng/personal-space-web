/** Visibility and BFCache state for a reusable DOM component. */
export function observeElementActivity(element: HTMLElement, change: (active: boolean) => void) {
  let suspended = false;
  let disposed = false;
  let previous: boolean | undefined;
  const update = () => {
    // A decorative component can be aria-hidden itself while remaining visible.
    // The host's aria-hidden state controls routed panels and projections.
    const active = !disposed && !suspended && element.isConnected && !document.hidden &&
      !element.closest('[hidden], [inert]') && !element.parentElement?.closest('[aria-hidden="true"]');
    if (active === previous) return;
    previous = active;
    change(active);
  };
  const observer = new MutationObserver(update);
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    observer.observe(ancestor, { attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden'] });
  }
  const hide = () => { suspended = true; update(); };
  const show = () => { suspended = false; update(); };
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  update();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
    if (previous) change(false);
  };
}
