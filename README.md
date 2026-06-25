# Astro Justin Web

Active Astro rebuild of JustinWeb.

This version builds the site as **Justin OS** and introduces **Justin Kit**, a
personal component library for reusable web, motion, design, and Flutter pieces.

## Current Implementation

Implemented now:

- Astro 6 server project with `@astrojs/node` in standalone mode.
- `Justin OS` launch page at `/`.
- Full-screen terminal/laptop visual shell with camera-style open and scroll
  return motion.
- Terminal boot sequence with skippable typing, randomized typo/backspace
  correction for `echo "I need some tokens and coffee"`, and a text-only
  `launchd [....] 00-100%` progress line before OS launch.
- Scroll wheel interaction inside the OS: scrolling down pulls the whole laptop
  away from the camera; scrolling back up returns to fullscreen and replays the
  menu-bar entrance.
- Launch dock with visual navigation anchors for `首页`, `作品集`, and `我的OS`.
- Pure Klein blue theme: all brand-blue surfaces and controls use `#002FA7`
  / `rgb(0, 47, 167)`, including the terminal screen, OS desktop projection,
  and active dock item. Screen backgrounds must stay solid color, not gradients.
- Justin Kit source folder and typed catalog.
- Extracted `Cursor Reveal Hero` Astro component.
- Extracted `Local Activity Status` Astro component.
- Astro API routes for the local activity monitor.

Not implemented yet:

- A dedicated `/kit` route.
- Rendering Justin Kit catalog cards on the homepage.
- Full OS sections beyond the launch screen, such as works, agent chat, or a
  footer terminal.
- Fullscreen component preview pages.

## Commands

Astro 6 requires Node `>=22.12.0`. This repo includes `.node-version` with the
local tested version:

```bash
node -v
# expected locally: v22.22.3
```

```bash
npm install
npm run dev
npm run build
npm run preview
```

The dev and preview scripts bind to `0.0.0.0:4321`.

If `npm run build` reports Node `v20.x`, switch the shell to the version in
`.node-version` before running npm scripts.

On this machine, direct Astro build verification has also used:

```bash
/Users/leftzhou/.hermes/node/bin/node node_modules/astro/bin/astro.mjs build
```

## Project Structure

```text
JustinWeb/
  src/pages/index.astro                         Justin OS launch page
  src/pages/api/activity/update.ts              POST activity updates
  src/pages/api/activity/stream.ts              SSE activity stream
  src/layouts/BaseLayout.astro                  HTML shell
  src/styles/global.css                         launch page styling
  src/data/kit.ts                               Justin Kit catalog
  src/justin-kit/                               component library source
```

The API route files intentionally re-export the local-activity runtime from the
Justin Kit component folder. That keeps the component portable while still
wiring it into Astro:

```ts
export { POST, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-update";
export { GET, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-stream";
```

## Local Activity Monitor

Create `.env.local` from `.env.example`, or export the same variables in your
shell:

```bash
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:4321
ACTIVITY_MONITOR_POLL_INTERVAL_MS=2000
ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS=12000
ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS=4000
```

Run the site and listener in two terminals from this directory:

```bash
npm run dev
npm run monitor:activity
```

The flow is:

```text
macOS foreground app -> POST /api/activity/update -> in-memory TTL store -> SSE /api/activity/stream -> LocalActivityStatus badge
```

Notes:

- `ACTIVITY_MONITOR_TOKEN` is required by the Astro `POST` route.
- The monitor sends the token as a bearer token.
- The script loads `.env.local` and `.env` from the current working directory.
- The monitor depends on `/usr/bin/osascript` and macOS System Events.
- The terminal app running the monitor may need Accessibility permission.
- Unknown app names are intentionally hidden until added to
  `src/justin-kit/components/local-activity-status/runtime/catalog.ts`.

## Documentation

- `src/justin-kit/README.md`: Justin Kit catalog and extraction boundaries.
- `src/justin-kit/components/cursor-reveal-hero/README.md`: cursor reveal
  component usage.
- `src/justin-kit/components/local-activity-status/README.md`: local activity
  component and runtime usage.
- `docs/README.md`: repository-level documentation index.

## Legacy Note

The old Next implementation was only used as source material and has been
removed from the working tree. The active clean surface is this Astro root
project plus the extracted Justin Kit component folders.
