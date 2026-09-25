# JustinWeb Agent Instructions

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
- `src/content/journal/` owns Markdown. `scripts/journal-content.mjs` compiles text without Chromium; `scripts/journal-build.mjs` generates fixed pages for `build:release`.
- `src/content/canvas/published.ts` owns canvas cards and IDs; `src/contracts/canvas.ts` defines plain content types. Use `justinweb-canvas-content` for content and layout changes.
- `src/justin-kit/components/`: reusable components and their runtimes, maintained according to component READMEs. The `macos-desktop` component owns desktop and window behavior.
- `public/os-desktop/`: file-driven desktop content, scanned here in development and from `dist/client/os-desktop/` in production.
- `src/pages/api/activity/`, `src/data/stores/activity/`, `src/infrastructure/server/activityStream.ts`, and Justin Kit's `local-activity-status` are the activity chain. Trace affected callers before editing.
- `src/content/site/studio-files.json` sets file order. `src/data/selectors/studioFiles.ts` derives the file box and reading data from `projects.json` and `resume.json`. Shared styles live in `src/presentation/ui/styles/`.

## Interaction Contracts

- `/home` opens the studio, `/works` the file collection, `/canvas` the personal canvas, and `/os` Justin OS. The client normalizes `/` to `/home`.
- `/journal` and `/journal/[slug]` open the diary. Preserve stable article slugs, physical front/back page order, fixed pagination across devices, and HTML reading access when WebGL fails. Page turns do not push browser history.
- The URL determines the stable page and updates when navigation starts. Animation handles the visual transition. Returning to the studio reuses a known home history entry or replaces the current entry.
- The studio uses a freestanding desk-and-chair composition: the computer opens OS, the flat iPad opens the canvas, and the upright file box opens the file collection. File details require a separate activation; reject retargeted scene clicks and drag gestures. The signature overlays the bottom of the scene.
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
- Ordinary development and builds compile readable journal text without Chromium. Install the pinned Playwright Chromium with `npm run journal:setup` before `build:release` or pagination tests. Generated journal assets are local build output; edit Markdown and layout sources instead. Use temporary input, output, and asset directories for validation.
- Check UI and animation changes on desktop and narrow viewports, including intermediate frames. For studio interactions, check dragging, clicking, hovering, entry, and return. Base touch and performance claims on checks using the relevant devices.
- For routing or shell changes, check direct loading, refresh, back/forward, and mid-animation navigation across `/`, `/home`, `/works`, `/canvas`, and `/os`. Check viewport changes when transitions depend on dimensions.
- For canvas changes, verify position restoration/reset, invalid storage fallback, content and edge validity, mobile reading, and static asset paths. For desktop scanning or deployment changes, verify built content and `/api/health`.
- For local activity changes, check affected endpoints, authentication, event streams, and required environment configuration. Report checks actually performed, their results, and remaining risks.

## Workspace and Documentation

- Inspect the branch, working tree, and existing changes before starting. The current working branch is `main`; continue in the user-designated branch and workspace.
- Implement the confirmed scope and preserve existing changes. Creating or switching branches or worktrees, committing, pushing, and releasing require explicit requests for those actions. Use Conventional Commits when authorized to commit.
- Store temporary plans and validation artifacts in `.workspace/`; place durable documentation according to ownership.
- Use `.agents/skills/README.md` to select relevant project skills. `docs/develop/workflow.md` owns the persistent workflow.
- `README.md` owns repository navigation and runtime instructions; `CONTEXT.md` owns shared terminology; `docs/README.md` indexes documentation; `docs/work/` tracks active work, backlog, and decisions.
- Keep Justin Kit rules in `src/justin-kit/README.md` and component usage in component READMEs. Record version-level facts in `CHANGELOG.md`.
- Write `AGENTS.md` in English using concise, actionable instructions for agents.
- Align documentation with current code, configuration, and observed behavior. Describe current responsibilities, behavior, and constraints; keep detailed visual parameters and phase acceptance records in the relevant feature documentation.
