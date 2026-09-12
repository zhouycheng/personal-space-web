---
name: justinweb-implementation
description: "Implement confirmed JustinWeb code, styles, scripts, and documentation while preserving architecture boundaries and unrelated user changes. Use only inside the JustinWeb repository; route project-skill maintenance to justinweb-skill-create."
---

# JustinWeb Implementation

## Shared Context

Read `.agents/skills/README.md`, the accepted plan when one exists, and relevant source.

## Rules

- Implement only confirmed scope.
- Follow the ownership map in `AGENTS.md` and trace affected callers before editing shared behavior.
- Use `apply_patch` for manual edits.
- Prefix shell commands with `rtk`.
- Add validation proportional to risk and hand shared-flow changes to `justinweb-validation` for full checks.
- Avoid unrelated refactors, formatting churn, generated artifacts, and user-change reversions.
- Update docs only when current facts changed.
- Stop and explain when the accepted plan becomes unsafe or impossible.

## Handoff

Report changed behavior, preserved boundaries, deliberately unchanged areas, validation run, and remaining risk.
