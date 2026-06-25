# Local Activity Status

Category: `JS Motion`

Status: complete Astro extraction. The Astro API routes are wired in this
project; the badge component is available but not mounted on the current launch
page yet.

This component preserves the local foreground-app monitor from the old homepage
and keeps the whole runtime inside this Justin Kit folder.

## Files

- `LocalActivityStatus.astro` renders the live badge.
- `local-activity-status.css` contains the badge states and layout.
- `local-activity-status.ts` listens to SSE with `EventSource`.
- `runtime/types.ts` defines the wire payload and snapshot shape.
- `runtime/catalog.ts` maps macOS app names to display text.
- `runtime/store.ts` keeps the in-memory status with a TTL.
- `runtime/astro-update.ts` exports the Astro `POST` route.
- `runtime/astro-stream.ts` exports the Astro SSE `GET` route.
- `scripts/activity-monitor.mjs` polls the macOS foreground app with `osascript`.
- `source-notes.md` records the old Next source files used during extraction.

## Astro Routes

The project route files intentionally re-export the runtime from this component:

```ts
export { POST, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-update";
export { GET, prerender } from "../../../justin-kit/components/local-activity-status/runtime/astro-stream";
```

## Usage

```astro
---
import LocalActivityStatus from "./LocalActivityStatus.astro";
---

<LocalActivityStatus />
```

## Runtime

Create `.env.local` from `.env.example`, or export these variables before
starting the site and monitor:

```bash
ACTIVITY_MONITOR_TOKEN=replace-with-a-long-random-token
ACTIVITY_MONITOR_URL=http://localhost:4321
ACTIVITY_MONITOR_POLL_INTERVAL_MS=2000
ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS=12000
ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS=4000
```

Run the site and listener in two terminals:

```bash
npm run dev
npm run monitor:activity
```

The flow is:

```text
macOS foreground app -> POST /api/activity/update -> in-memory TTL store -> SSE /api/activity/stream -> LocalActivityStatus
```

The monitor is macOS-only because it depends on `osascript` and System Events.
If an app is not shown, add its name or alias to `runtime/catalog.ts`.

## API Contract

`POST /api/activity/update` accepts JSON:

```json
{
  "appName": "Cursor",
  "state": "active",
  "observedAt": 1760000000000,
  "sessionId": "optional-session-id"
}
```

Authentication is required. The monitor sends:

```text
Authorization: Bearer <ACTIVITY_MONITOR_TOKEN>
```

The route also accepts `x-activity-token` for simple local clients.

`GET /api/activity/stream` returns server-sent events. Each message is either an
activity snapshot or `null` when the status is idle, expired, inactive, or
unknown.

## Timing

- Monitor poll interval: `ACTIVITY_MONITOR_POLL_INTERVAL_MS`, default `2000`.
- Monitor heartbeat post interval: `ACTIVITY_MONITOR_HEARTBEAT_INTERVAL_MS`,
  default `12000`.
- Monitor request timeout: `ACTIVITY_MONITOR_REQUEST_TIMEOUT_MS`, default
  `4000`.
- Server status TTL: `25000` ms.
- SSE heartbeat interval: `15000` ms.

## Integration Checklist

- Run both `npm run dev` and `npm run monitor:activity` from
  the repository root.
- Ensure the same token is visible to the Astro server and the monitor script.
- Grant macOS Accessibility permission to the terminal app if `osascript` cannot
  read System Events.
- Add new foreground-app names to `runtime/catalog.ts` before expecting them to
  appear in the badge.
