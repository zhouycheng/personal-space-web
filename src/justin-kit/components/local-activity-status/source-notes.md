# Source Notes

The monitor remains intentionally one-way:

```text
local macOS script -> Astro API -> server memory store -> browser SSE badge
```

The browser cannot control the local Mac. It only receives the latest snapshot.

Important behavior to preserve:

- require `ACTIVITY_MONITOR_TOKEN`,
- clear the status on inactive/unknown apps,
- keep a TTL so stale status disappears,
- avoid saving history,
- keep app-name-to-copy mapping in `runtime/catalog.ts`.

Current Astro implementation:

- `scripts/activity-monitor.mjs` loads `.env.local` or `.env`, reads the
  foreground app with `/usr/bin/osascript`, and posts bearer-token updates.
- `runtime/astro-update.ts` validates the token and payload before updating the
  in-memory store.
- `runtime/store.ts` keeps only the latest supported app snapshot and expires it
  after `25000` ms.
- `runtime/astro-stream.ts` streams snapshots over SSE and sends heartbeat
  comments every `15000` ms.
- `local-activity-status.ts` subscribes with `EventSource` and updates the badge
  state in the browser.

The browser still cannot control the local Mac. It only receives a sanitized
snapshot of the most recent supported foreground app.
