# JustinSpace Agent Instructions

## Runtime

The application runs from the repository root using Astro 7 server output, the `@astrojs/node` standalone adapter, and React integration.

- Check `package.json` engines for the Node requirement, currently `>=22.12.0`. Use the version recorded in `.node-version` for development and validation; it is currently `26.9.0`.
- Use the same Node version to install dependencies, start the application, and run tests.
- Development and preview scripts default to `0.0.0.0:4321`. Use the actual address reported by the startup log for browser checks and reuse an existing service when available.

## Code Ownership

- `src/pages/`: route and API entry points mounting `src/presentation/ui/app/JustinAppShell.astro`.
- `src/app/`: dependency composition, URL navigation, and shell lifecycle. `src/contracts/` defines content, intent, and port types without UI or renderer dependencies.
- `src/content/` owns published records and assets. `src/data/repositories/` reads them; `src/data/selectors/` derives portfolio and file views; `src/data/stores/` holds per-shell client state and the activity snapshot.
- `src/application/` owns use cases and intent decisions. `src/presentation/scene/` owns Three.js objects and renderer disposal; `src/presentation/interaction/` maps gestures to user intent; `src/animation/` owns camera and projection timing. `src/config/` holds appearance and lighting parameters.
- `src/presentation/ui/` owns Astro/React components, browser runtimes, and styles. `src/infrastructure/client/` owns browser storage; `src/infrastructure/server/` owns server data access and streams.
- `src/content/journal/` owns Markdown. `scripts/journal/` owns fingerprints, compilation and immutable book packages. `current.json` is the sole activation pointer; track the active validated package. Runtime manifests contain metadata and page regions, never full HTML.
- `src/content/canvas/published.ts` owns canvas cards and IDs; `src/contracts/canvas.ts` defines plain content types. Use `justinspace-canvas-content` for content and layout changes.
- `src/justin-kit/components/`: reusable components and their runtimes, maintained according to component READMEs. The `macos-desktop` component owns desktop and window behavior.
- `public/os-desktop/`: file-driven desktop content, scanned here in development and from `dist/client/os-desktop/` in production.
- `src/pages/api/activity/`, `src/data/stores/activity/`, `src/infrastructure/server/activityStream.ts`, and Justin Kit's `local-activity-status` are the activity chain. Trace affected callers before editing.
- `src/content/site/studio-files.json` sets file order. `src/data/selectors/studioFiles.ts` derives the file box and reading data from `projects.json` and `resume.json`. Shared styles live in `src/presentation/ui/styles/`.

## Interaction Contracts

- `/home` opens the studio, `/works` the file collection, `/canvas` the personal canvas, and `/os` Justin OS. The client normalizes `/` to `/home`.
- `/journal` and `/journal/[slug]` open the 3D-only diary. Preserve stable slugs, physical front/back order and fixed pagination across devices. A WebGL or resource failure must expose an independent error, retry and exit UI. Page turns do not push history.
- The URL determines the stable page and updates when navigation starts. Animation handles the visual transition. Returning to the studio reuses a known home history entry or replaces the current entry.
- The studio places a plank desk and canvas chair on a sand island, with the complete shoreline framed by default. The computer opens OS, the flat iPad opens the canvas, and the ground-level wooden file crate opens the file collection. File details require a separate activation; reject retargeted scene clicks and drag gestures. The signature overlays the bottom of the scene.
- Keep island environment objects outside the furniture picking tree. Share shoreline parameters between sand and water, preserve furniture world coordinates, and pause ocean time in hidden/fullscreen states. Reduced-motion and lightweight modes use static water.
- Keep the computer and iPad fixed. The camera first faces the screen, then approaches it as live content fades in over the screen and expands to fullscreen. Reverse this sequence on return.
- Preserve on-demand rendering, background suspension, and resource disposal. Maintain keyboard entry points, WebGL fallback access, and `prefers-reduced-motion` behavior when changing interactions.

## Data Boundaries

- Canvas content and static assets are repository-managed. Visitors can only save moved card positions in localStorage; never persist content or viewport overrides.
- Preserve stable card IDs, remove incident edges when deleting cards, and retain local overrides for unchanged IDs.
- Keep credentials in the runtime environment and document variables in `.env.example`.

## Commands

Prefix shell commands with `rtk` unless debugging requires raw output. Run application commands from the repository root:

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run build:release
rtk npm run check:boundaries
rtk npm run check:types
rtk npm run test:unit
rtk npm run test:e2e
rtk npm run preview
rtk npm run monitor:activity
```

`tests/*.test.mjs` uses Node's built-in test runner and covers navigation, studio logic, canvas behavior, desktop scanning, and health checks. Verify command entry points against `package.json` and the actual test files.

## Validation

- Run `rtk npm run build`, `rtk npm run check:boundaries`, and `rtk npm run check:types` as the baseline. Run relevant Node tests for logic changes and the full suite for shared-flow changes. Report build and type-check results separately.
- Ordinary development and builds validate the pregenerated journal package without Chromium. Development reports missing/outdated books; production builds fail on missing, corrupt or stale packages. Install pinned Chromium with `journal:setup` before explicit `journal:build`, `build:release` or `test:journal:render`. Update the active package allowlist in `.gitignore` when publishing changed content. Use isolated directories for generation tests.
- `test:unit` never launches a browser. `test:e2e` uses the existing production build and unified Playwright fixtures; `test:e2e:release` builds first. Record browser/environment failures separately from passes. Keep traces, screenshots and performance raw data in `.workspace/`.
- Capture B0/B1/B2 under matching conditions and compare three repeats. A software WebGL backend, mobile emulation and JS heap do not establish device FPS or total GPU memory.
- Check UI and animation changes on desktop and narrow viewports, including intermediate frames. For studio interactions, check dragging, clicking, hovering, entry, and return. Base touch and performance claims on checks using the relevant devices.
- For routing or shell changes, check direct loading, refresh, back/forward, and mid-animation navigation across `/`, `/home`, `/works`, `/canvas`, and `/os`. Check viewport changes when transitions depend on dimensions.
- For canvas changes, verify position restoration/reset, invalid storage fallback, content and edge validity, mobile reading, and static asset paths. For desktop scanning or deployment changes, verify built content and `/api/health`.
- For local activity changes, check affected endpoints, authentication, event streams, and required environment configuration. Report checks actually performed, their results, and remaining risks.

## Workspace and Documentation

- Inspect the branch, working tree, and existing changes before starting. Use `develop` as the default working branch for routine work; `main` is the protected production branch.
- Implement the confirmed scope and preserve existing changes. Creating or switching branches or worktrees, committing, pushing, and releasing require explicit requests. When commits or pushes are requested, target `develop` by default. Never push directly to `main`; merge production changes through a pull request from `develop` to `main`. Use Conventional Commits when authorized to commit.
- Keep temporary plans, experiments, and validation artifacts in the ignored `.workspace/`; remove generated files when their task is complete and they are no longer needed.
- Use `.agents/skills/README.md` to select relevant project skills. `docs/develop/workflow.md` owns the persistent workflow.
- `README.md` owns repository navigation and runtime instructions; `CONTEXT.md` owns shared terminology; `docs/README.md` indexes current documentation; root `CHANGELOG.md` owns dated history. Discuss candidate work in the task and keep temporary plans in `.workspace/`.
- Keep Justin Kit rules in `src/justin-kit/README.md` and component usage in component READMEs. Record version-level facts in `CHANGELOG.md`.
- Write `AGENTS.md` in English using concise, actionable instructions for agents.
- Align documentation with current code, configuration, and observed behavior. Keep responsibilities, constraints, visual parameters, and validation procedures in their owning docs. Move development records to root `CHANGELOG.md`; `docs/` must contain no historical sections or changelog index entries. Preserve root README and changelog presentation when editing content.
