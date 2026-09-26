import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CanvasActivityContext } from "./canvasActivityContext";
import type { CanvasSession } from "./canvasSession";

const MineCanvasEditor = lazy(() => import("./MineCanvasEditor"));

function isCanvasRouteActive() {
  return window.document.getElementById("page-canvas")?.classList.contains("is-active") ?? false;
}

export default function MineCanvasLoader() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [active, setActive] = useState(false);
  const session = useRef<CanvasSession>({});

  useEffect(() => {
    const page = window.document.getElementById("page-canvas");
    if (!page) return;
    let unloadTimer = 0;
    let suspended = false;
    const update = () => {
      const routeActive = isCanvasRouteActive();
      setActive(routeActive && !document.hidden && !suspended);
      if (routeActive) {
        clearTimeout(unloadTimer);
        unloadTimer = 0;
        setShouldLoad(true);
      } else if (!unloadTimer) {
        unloadTimer = window.setTimeout(() => { unloadTimer = 0; setShouldLoad(false); }, 60_000);
      }
    };
    const hide = () => { suspended = true; update(); };
    const show = () => { suspended = false; update(); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(page, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      observer.disconnect();
      clearTimeout(unloadTimer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, []);

  if (!shouldLoad) return null;
  return (
    <Suspense fallback={<div className="mine-canvas-bootstrap" role="status">正在打开画布…</div>}>
      <CanvasActivityContext.Provider value={active}>
        <MineCanvasEditor active={active} session={session.current} />
      </CanvasActivityContext.Provider>
    </Suspense>
  );
}
