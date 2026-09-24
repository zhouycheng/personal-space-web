---
name: justinweb-canvas-content
description: "Maintain JustinWeb canvas cards, connections, default positions, styles, images and custom React presentation through repository files. Use for Agent-managed canvas content; visitors only browse and locally reposition cards."
---

# JustinWeb Canvas Content

## Sources

- Read `src/components/mine-canvas/mineCanvasData.ts`: the published, typed document and stable card IDs.
- Read `mineCanvasTypes.ts` for card fields, dimensions, connections and text styles.
- `CanvasCardContent.tsx` renders content directly on spatial cards. `mine-canvas.css` owns canvas styles.
- `MineCanvasEditor.tsx` owns viewing, navigation and browser-local positions; despite its legacy filename, it provides no content editor.
- Store published images in `public/canvas/` and reference them as `/canvas/filename.ext`.

## Workflow

1. Inspect current cards and edges before changing them. Preserve existing content outside the request.
2. Query cards by stable ID; report matching titles and fields. For updates, keep IDs stable. For additions, choose unique descriptive IDs. On deletion, remove incident edges.
3. Set website positions in `position`, dimensions in both `data.width/height` and node `style`; use the existing node helper. Set accents and supported text styles in typed data.
4. Treat HTML fields as trusted repository content: author semantic HTML, never insert scripts, event handlers or unreviewed external HTML.
5. For new functionality, extend the discriminated data type and React content renderer. Show complete content directly on nodes; there is no reading panel. Keep interactions compatible with whole-card dragging, double-click focus, blank-canvas double-click overview, and mobile zooming. Enter/Space focuses a node. Keep links independently clickable with the nodrag class.
6. Check IDs, edge endpoints, asset paths and visible content. Build and inspect desktop/mobile when requested by the task or required by its accepted validation scope.

## Invariants

- Published content comes only from repository files. No database, web author login, uploads or save API.
- Visitors may move cards. Only moved positions are saved in `justin-canvas-positions-v1`; never persist content, styling, connections or viewport.
- Existing local positions override new defaults for the same ID. Do not change IDs to force layout updates. Visitors can choose Restore Default Layout.
- Preserve the studio palette and other pages when changing canvas styles.
- Commit, push and deploy require the corresponding user authorization. Editing this document is not a deployment.
