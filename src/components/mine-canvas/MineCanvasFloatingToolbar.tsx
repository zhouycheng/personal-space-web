import { autoUpdate, flip, FloatingPortal, offset, shift, useFloating } from "@floating-ui/react";
import type { ReactNode } from "react";

export function MineCanvasFloatingToolbar({
  children,
  open,
  reference,
}: {
  children: ReactNode;
  open: boolean;
  reference: HTMLElement | null;
}) {
  const sidebarRight = typeof window === "undefined"
    ? 0
    : (window.document.querySelector(".mine-canvas-sidebar")?.getBoundingClientRect().right || 0);
  const { floatingStyles, refs } = useFloating({
    elements: { reference },
    middleware: [
      offset(10),
      flip({ padding: 12 }),
      shift({ padding: { top: 12, right: 12, bottom: 12, left: sidebarRight + 12 } }),
    ],
    open,
    placement: "top",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  if (!open || !reference) return null;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        className="mine-floating-toolbar nodrag nopan nowheel"
        style={floatingStyles}
        role="toolbar"
        aria-label="卡片编辑工具"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}
