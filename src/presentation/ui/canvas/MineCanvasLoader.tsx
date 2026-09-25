import { lazy, Suspense, useEffect, useState } from "react";

const MineCanvasEditor = lazy(() => import("./MineCanvasEditor"));

function isCanvasRouteActive() {
  return window.document.getElementById("page-canvas")?.classList.contains("is-active") ?? false;
}

export default function MineCanvasLoader() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const page = window.document.getElementById("page-canvas");
    if (!page) return;
    const update = () => {
      if (isCanvasRouteActive()) setShouldLoad(true);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(page, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!shouldLoad) return null;
  return (
    <Suspense fallback={<div className="mine-canvas-bootstrap" role="status">正在打开画布…</div>}>
      <MineCanvasEditor />
    </Suspense>
  );
}
