# JustinWeb Documentation

This folder tracks project-level documentation for the Astro JustinWeb rebuild.
The active source of truth is the Astro app at the repository root.

## Current Status

As of 2026-06-26:

- The active runtime is Astro 6 with the Node standalone adapter.
- The active app root is this repository root.
- Node must be `>=22.12.0`; `.node-version` currently records `22.22.3`.
- The homepage currently renders the Justin OS launch screen with terminal boot,
  text progress, fullscreen projection, and scroll-driven laptop camera motion.
- The project theme color is pure Klein blue `#002FA7`
  (`rgb(0, 47, 167)`). Brand-blue UI, the terminal screen, OS desktop
  projection, and active dock controls should use this solid color instead of
  blue gradients.
- Justin Kit exists as a source-first component library under
  `src/justin-kit/`.
- `Cursor Reveal Hero` and `Local Activity Status` are extracted components.
- Local activity API routes are wired, but the badge is not mounted on the
  current launch page.
- The old Next implementation has been removed from the working tree.

## Document Index

- `../README.md`: repository entrypoint and migration summary.
- `../src/justin-kit/README.md`: Justin Kit catalog and component boundaries.
- `../src/justin-kit/components/cursor-reveal-hero/README.md`:
  cursor reveal component usage and behavior.
- `../src/justin-kit/components/local-activity-status/README.md`:
  local activity component, API, timing, and monitor setup.
- `plans/2026-06-25-astro-justin-os-kit.md`: implementation record for the Astro
  rebuild.

## Update Rules

- If docs and source disagree, trust the source and update the docs.
- If Astro commands fail with Node `v20.x`, switch to the version in
  `.node-version` before debugging app code.
- Keep root docs focused on orientation and runtime details.
- Keep component-level behavior in each component README.
- Record completed implementation plans as status records instead of leaving
  them as future-tense plans.
- Do not document a homepage section, route, or component preview as shipped
  until it is actually wired into `src/pages`.
