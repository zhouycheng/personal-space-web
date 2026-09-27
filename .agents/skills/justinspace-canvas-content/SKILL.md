---
name: justinspace-canvas-content
description: "Maintain JustinSpace canvas cards, edges, positions, styles, assets, and card rendering in repository files."
---

# JustinSpace Canvas Content

## Ownership

- Published cards and edges: `src/content/canvas/published.ts`.
- Data kinds and fields: `src/contracts/canvas.ts`.
- Card rendering and styles: `src/presentation/ui/canvas/CanvasCardContent.tsx` and `mine-canvas.css`.
- Canvas interaction: `MineCanvasEditor.tsx`; visitor positions: `src/infrastructure/client/canvasPositions.ts`.
- Published images: `public/canvas/`, referenced as `/canvas/filename.ext`.

## Editing

1. Inspect the current nodes, stable IDs, edges, card renderer, and asset paths before editing.
2. Preserve IDs for existing cards. Give new cards unique IDs and remove incident edges when deleting a card.
3. Use the existing node helper. Keep width and height consistent across node data and style.
4. Treat HTML fields as trusted repository content. Add semantic markup only; do not add scripts, event handlers, or unreviewed external HTML.
5. When adding a card kind, update the contract and renderer. Keep whole-card dragging, double-click focus, blank-canvas overview, keyboard access, mobile zoom, and independently clickable links working.
6. Check content, edge endpoints, dimensions, and asset paths. For layout or renderer changes, run the relevant checks from `AGENTS.md` and inspect desktop and narrow layouts.

## Invariants

- The repository owns published content. Visitors can only store moved-card positions under `justin-canvas-positions-v1`.
- Never persist content, style, edge, viewport, or editor overrides.
- Existing saved positions override defaults for matching IDs. Do not rename an ID to force a layout reset; visitors can restore the default layout.
- Preserve the studio palette and other pages.
- Commit, push, and deployment require the corresponding user authorization.
