# JustinWeb Documentation

This folder tracks project-level documentation for the Astro JustinWeb rebuild.
The active source of truth is the Astro app at the repository root.

## Current Status

As of 2026-06-26:

- The active runtime is Astro 6 with the Node standalone adapter.
- The active app root is this repository root.
- Node must be `>=22.12.0`; `.node-version` currently records `22.22.3`.
- The dock routes are `/home`, `/works`, and `/os`; `/` remains a homepage
  alias. The shared app shell uses History API navigation so route refreshes do
  not fall back to the homepage.
- The homepage currently renders the Justin OS launch screen with terminal boot,
  text progress, fullscreen projection, and scroll-driven laptop camera motion.
- Terminal boot timing is intentionally 20% faster than the original rebuild
  timing, while keeping the same typing, typo, backspace, and progress-line
  behavior.
- The homepage persists mid-collapse `推拉状态` progress in same-tab
  `sessionStorage`, so returning to `/home` from another route or refreshing
  `/home` resumes the same transition point when Justin OS is being pushed back
  toward the terminal.
- Homepage launch discussion should use the shared state names from
  `../CONTEXT.md`: `全显状态`, `推拉状态`, and `Justin OS 状态`.
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

- `../CONTEXT.md`: shared vocabulary and homepage state definitions.
- `../README.md`: repository entrypoint and migration summary.
- `../CHANGELOG.md`: version-level changes and verified milestones.
- `work/active.md`: current active surfaces, validation baseline, and risks.
- `work/backlog.md`: confirmed local requirement pool.
- `work/decisions.md`: index of active decisions.
- `develop/workflow.md`: workflow, scope gates, validation, Git, and release rules.
- `lessons.md`: reusable diagnosis and project-operation lessons.
- `../.agents/skills/README.md`: project-local workflow skill router and pre-read protocol.
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
- Keep workflow and skill-routing rules synchronized with `.agents/skills/README.md`.
- Keep component-level behavior in each component README.
- Record completed implementation plans as status records instead of leaving
  them as future-tense plans.
- Do not document a homepage section, route, or component preview as shipped
  until it is actually wired into `src/pages`.
