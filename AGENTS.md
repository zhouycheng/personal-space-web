# JustinWeb Agent Instructions

## Runtime

The application runs from the repository root using Astro 7 server output, the `@astrojs/node` standalone adapter, and React integration.

- Check `package.json` engines for the Node requirement, currently `>=22.12.0`. Prefer the version recorded in `.node-version`, currently `22.22.3`, for development and validation.
- Use the same Node version to install dependencies, start the application, and run tests. For `better-sqlite3` native module ABI errors, check the active Node version and dependency build environment first.
- Development and preview scripts default to `0.0.0.0:4321`. Use the actual address reported by the startup log for browser checks and reuse an existing service when available.

## Code Ownership

- `src/pages/*.astro`: route entry points mounting the shared `src/components/app/JustinAppShell.astro` shell.
- `src/app/navigation.ts`: route definitions and history decisions. `src/components/app/studioAppRuntime.ts`: navigation, spatial transitions, and page lifecycle coordination.
- `src/components/studio/`: Three.js scene, camera, object interactions, lighting, portfolio, and accessible HTML entry points. The scene requests navigation through callbacks; canvas modules own canvas content.
- `src/components/mine-canvas/`: ReactFlow editor and card UI. `src/features/canvas/`: document protocol, client sessions, asset interfaces, and serialized save queue.
- `src/server/canvas/`: SQLite revisions, author authentication, and image storage. `src/pages/api/canvas*`: HTTP interfaces.
- `src/justin-kit/components/`: reusable components and their runtimes, maintained according to component READMEs. The `macos-desktop` component owns desktop and window behavior.
- `public/os-desktop/`: file-driven desktop content, scanned here in development and from `dist/client/os-desktop/` in production.
- `src/pages/api/activity/`, `src/lib/activity/`, and Justin Kit's `local-activity-status`: local activity endpoints, state, and monitoring. Trace each affected endpoint's actual call chain before editing.
- `src/data/projects.json`: portfolio content. `src/data/kit.ts`: Justin Kit catalog. Shared layout lives in `src/styles/global.css`; domain styles stay with their components.
- `ops/backup/`: backup, restore, and integrity checks independent of the Web process.

## Interaction Contracts

- `/home` opens the studio, `/works` the portfolio, `/canvas` the personal canvas, and `/os` Justin OS. The client normalizes `/` to `/home`.
- The URL determines the stable page and updates when navigation starts. Animation handles the visual transition. Returning to the studio reuses a known home history entry or replaces the current entry.
- The studio uses a freestanding desk-and-chair composition: the computer opens OS, the flat iPad opens the canvas, and the desktop document rack opens the portfolio. The signature overlays the bottom of the scene.
- Keep the computer and iPad fixed. The camera first faces the screen, then approaches it as live content fades in over the screen and expands to fullscreen. Reverse this sequence on return.
- Preserve on-demand rendering, background suspension, and resource disposal. Maintain keyboard entry points, WebGL fallback access, and `prefers-reduced-motion` behavior when changing interactions.

## Data Boundaries

- Canvas saves append immutable revisions and include `expectedRevision`. Conflicts return `409`; the client preserves pending content and stops overwriting. Restoring a historical version creates a new revision.
- Author sessions combine an HttpOnly cookie with a tab-scoped token. Enforce authentication, input validation, and resource access control on the server.
- Treat databases, images, backups, and credentials as runtime data. Use isolated temporary paths for tests and restore validation. Before applying a production restore, verify backups, stop the Web service, and obtain authorization for that operation.
- Document environment variables in `.env.example`; keep real credentials in the runtime environment.

## Commands

Prefix shell commands with `rtk` unless debugging requires raw output. Run application commands from the repository root:

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run preview
rtk node --test tests/*.test.mjs
rtk npm run monitor:activity
```

`tests/*.test.mjs` uses Node's built-in test runner and covers navigation, studio logic, canvas behavior, desktop scanning, and health checks. Verify command entry points against `package.json` and the actual test files.

## Validation

- Run `rtk npm run build` as the baseline. Run relevant Node tests for logic changes and the full suite for shared-flow changes. Report build and type-check results separately.
- Check UI and animation changes on desktop and narrow viewports, including intermediate frames. For studio interactions, check dragging, clicking, hovering, entry, and return. Base touch and performance claims on checks using the relevant devices.
- For routing or shell changes, check direct loading, refresh, back/forward, and mid-animation navigation across `/`, `/home`, `/works`, `/canvas`, and `/os`. Check viewport changes when transitions depend on dimensions.
- For canvas storage changes, verify revision reads, save conflicts, authentication, SQLite integrity, and restoration to a temporary directory. For desktop scanning or deployment changes, verify built content and `/api/health`.
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
