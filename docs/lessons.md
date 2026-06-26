# Lessons

## Runtime

- Astro 6 requires Node `>=22.12.0`; Node 20 failures should be treated as environment drift before app debugging.
- `rtk npm run build` is the baseline verification command for repository changes.

## Documentation

- When docs and source disagree, trust the source and update docs during delivery.
- Do not describe planned routes or component previews as shipped until they are wired into `src/pages`.

## UI And Motion

- Homepage launch states should use `全显状态`, `推拉状态`, and `Justin OS 状态`.
- Justin OS transition work needs visual QA because fullscreen fixed layers, dock navigation, and page transitions can interact in subtle ways.

## Local Activity

- The activity monitor is macOS-only because it depends on `/usr/bin/osascript` and System Events.
- `ACTIVITY_MONITOR_TOKEN` is required for `POST /api/activity/update`.
