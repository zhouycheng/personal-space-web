# Active Work

## Current Focus

JustinWeb is focused on the Astro-based Justin OS homepage and Justin Kit extraction.

## Active Surfaces

- `src/pages/index.astro`: homepage route, launch state machine, navigation, Justin OS projection, and top menu events.
- `src/styles/global.css`: global layout, launch screen motion, navigation, responsive rules, and OS projection styling.
- `src/justin-kit/components/macos-desktop/`: reusable macOS-like desktop and window system.
- `public/os-desktop/`: file-backed Justin OS desktop content.
- `src/justin-kit/components/local-activity-status/`: local activity runtime and monitor.

## Validation Baseline

- `rtk npm run build`.
- Browser preview for interaction-heavy changes.
- Local activity changes require environment and route checks.

## Current Risks

- Homepage and Justin OS transitions are interaction-heavy and need visual QA on desktop and narrow screens.
- `public/os-desktop/` content is scanned at build time, so renamed files require page refresh or rebuild.
