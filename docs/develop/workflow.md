# JustinWeb Development Workflow

## Source Of Truth

- Runtime and setup: `README.md`.
- Stable vocabulary: `CONTEXT.md`.
- Documentation index: `docs/README.md`.
- Active work and backlog: `docs/work/`.
- Justin Kit rules: `src/justin-kit/README.md`.
- Project-local skills: `.agents/skills/README.md`.

## Requirement And Scope Gates

- Discuss candidates before adding them to `docs/work/backlog.md`.
- Implementation requires accepted scope unless the user explicitly requests end-to-end execution.
- Keep temporary plans in `.workspace/plans/` and durable facts in `docs/`.

## Architecture Boundaries

- `src/pages/index.astro` owns homepage routing, launch interactions, and OS projection mount points.
- `src/styles/global.css` owns shared layout and motion styling.
- `src/justin-kit/components/` owns reusable components and their runtime files.
- `public/os-desktop/` owns file-backed desktop content only.
- `src/pages/api/activity/` should remain thin re-exports of local activity runtime handlers.

## Commands

Run commands from the repository root and prefix command segments with `rtk`:

```bash
rtk npm install
rtk npm run dev
rtk npm run build
rtk npm run preview
rtk npm run monitor:activity
```

Node must satisfy `.node-version` and `package.json` engines: `>=22.12.0`.

## Validation

- Baseline: `rtk npm run build`.
- UI and motion changes need browser preview on desktop and narrow screens.
- Desktop scanner changes need `public/os-desktop/` file listing verification.
- Local activity changes need route and environment checks.

## Git And Delivery

- Current branch is usually `main`; do not create, stage, commit, push, tag, or publish without explicit instruction.
- Preserve unrelated user changes.
- Use Conventional Commit style when preparing commit recommendations.
- Update `CHANGELOG.md` only for version-level facts worth recalling.

## Release

Formal release documents belong under `docs/releases/vX.Y.Z/release.md` and require a user-specified version.
