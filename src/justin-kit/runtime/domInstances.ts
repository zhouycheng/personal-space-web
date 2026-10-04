/** Own each mounted instance, including removals and replacement after navigation. */
export function createDomInstances(selector: string, mount: (element: HTMLElement) => (() => void) | void) {
  const instances = new Map<HTMLElement, () => void>();
  let observer: MutationObserver | undefined;
  let started = false;
  function scan(records?:MutationRecord[]) {
    for (const [element, dispose] of instances) {
      if (!element.isConnected) {
        try { dispose(); } catch (error) { console.error('Component cleanup failed', error); }
        instances.delete(element);
      }
    }
    const attach=(element:HTMLElement)=>{if(element.isConnected&&!instances.has(element))instances.set(element,mount(element)??(()=>{}));};
    if(!records){document.querySelectorAll<HTMLElement>(selector).forEach(attach);return;}
    const added=new Set<Element>();
    for(const record of records)for(const node of record.addedNodes)if(node instanceof Element&&node.isConnected)added.add(node);
    for(const node of added){
      // A reparented instance remains mounted; nested additions are scanned once.
      let parent=node.parentElement,covered=false;
      while(parent){if(added.has(parent)){covered=true;break;}parent=parent.parentElement;}
      if(covered)continue;
      if(node instanceof HTMLElement&&node.matches(selector))attach(node);
      node.querySelectorAll<HTMLElement>(selector).forEach(attach);
    }
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
