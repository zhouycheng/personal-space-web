# Active Work

## Current Focus

JustinWeb is focused on the Astro-based Justin OS route shell, homepage state
transitions, and Justin Kit extraction.

## Active Surfaces

- `src/pages/index.astro`: `/` homepage alias that renders the shared app shell.
- `src/pages/home.astro`, `src/pages/works.astro`, `src/pages/os.astro`: dock route entrypoints.
- `src/components/app/JustinAppShell.astro`: shared route shell, launch state machine, History API navigation, Justin OS projection, personal canvas, and top menu events.
- `src/components/app/homeRuntimeState.mjs`: terminal timing scale and same-tab homepage transition snapshot helpers.
- `src/styles/global.css`: global layout, launch screen motion, dock navigation, personal canvas, responsive rules, and OS projection styling.
- `src/justin-kit/components/macos-desktop/`: reusable macOS-like desktop and window system.
- `public/os-desktop/`: file-backed Justin OS desktop content.
- `src/justin-kit/components/local-activity-status/`: local activity runtime and monitor.

## Validation Baseline

- `rtk npm run build`.
- `rtk node --test tests/*.test.mjs` for App shell helper logic.
- Browser preview for interaction-heavy changes, including direct refresh on
  `/`, `/home`, `/works`, and `/os`.
- Local activity changes require environment and route checks.

## Current Risks

- Homepage and Justin OS transitions are interaction-heavy and need visual QA on desktop and narrow screens.
- Route-shell changes need back/forward and refresh checks because homepage
  state is intentionally preserved within the current browser tab session.
- `public/os-desktop/` content is scanned at build time, so renamed files require page refresh or rebuild.
