/** Own each mounted instance, including removals and replacement after navigation. */
export function createDomInstances(selector: string, mount: (element: HTMLElement) => (() => void) | void) {
  const instances = new Map<HTMLElement, () => void>();
  let observer: MutationObserver | undefined;
  let started = false;
  function scan() {
    for (const [element, dispose] of instances) {
      if (!element.isConnected) {
        try { dispose(); } catch (error) { console.error('Component cleanup failed', error); }
        instances.delete(element);
      }
    }
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
      if (!instances.has(element)) instances.set(element, mount(element) ?? (() => {}));
    });
  }
  function destroy() {
    observer?.disconnect();
    observer = undefined;
    for (const [element, dispose] of instances) {
      try { dispose(); } catch (error) { console.error('Component cleanup failed', error); }
      instances.delete(element);
    }
    window.removeEventListener('pagehide', pagehide);
    document.removeEventListener('DOMContentLoaded', start);
    started = false;
  }
  function pagehide(event: PageTransitionEvent) { if (!event.persisted) destroy(); }
  function start() {
    if (started || !document.documentElement) return;
    started = true;
    scan();
    observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pagehide', pagehide);
  }
  return {
    init() {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
      else start();
    },
    destroy,
  };
}
