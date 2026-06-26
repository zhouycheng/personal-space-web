---
name: justinweb-implementation
description: "Implement confirmed JustinWeb tasks across Astro pages, CSS, Justin Kit components, desktop files, local activity scripts, docs, or project-local skills while preserving scope, architecture, repository style, and unrelated user changes. Use only inside the JustinWeb repository."
---

# JustinWeb Implementation

## Shared Context

Read `.agents/skills/README.md`, the accepted plan when one exists, and relevant source.

## Rules

- Implement only confirmed scope.
- Keep Astro pages, Justin Kit components, and `public/os-desktop/` responsibilities separate.
- Use `apply_patch` for manual edits.
- Prefix shell commands with `rtk`.
- Add validation proportional to risk; `rtk npm run build` is the baseline check.
- Avoid unrelated refactors, formatting churn, generated artifacts, and user-change reversions.
- Update docs only when current facts changed.
- Stop and explain when the accepted plan becomes unsafe or impossible.

## Handoff

Report changed behavior, preserved boundaries, deliberately unchanged areas, validation run, and remaining risk.
