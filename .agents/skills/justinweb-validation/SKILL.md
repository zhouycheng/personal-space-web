---
name: justinweb-validation
description: "Plan and perform JustinWeb validation: define checks before implementation, review diffs afterward, run relevant automated or manual checks, explain failures, fix validation issues when requested, and report concrete re-verification results. Use only inside the JustinWeb repository."
---

# JustinWeb Validation

## Shared Context

Read `.agents/skills/README.md`. For post-implementation work, inspect Git state and relevant diffs first.

## Modes

- Plan: define validation before implementation.
- Review: inspect scope, architecture, docs, runtime, desktop-file scanner behavior, browser interactions, and unrelated changes.
- Run: execute checks appropriate to touched files.

## Checks

- Run relevant Node tests; use `rtk node --test tests/*.test.mjs` for shared flows.
- Run `rtk npm run build` as the baseline and report `rtk npx tsc --noEmit` separately when type checking applies.
- For UI or animation changes, inspect desktop and narrow viewports, intermediate frames, reduced motion, keyboard access, and the affected interactions.
- For routing or shell changes, check direct loads, refresh, back/forward, and interrupted transitions across `/`, `/home`, `/works`, `/canvas`, and `/os`.
- For canvas changes, check published content, edge references, local position persistence/reset and mobile reading.
- For desktop, activity, health or Docker changes, follow the domain checks in `AGENTS.md` and verify the actual runtime boundary.

## Output

- Scope checked.
- Commands or manual checks and results.
- Findings ordered by severity.
- Fix and re-run results.
- Residual risks.

Separate automated results, browser observations, and device-dependent behavior that was not exercised.

Do not prepare commit, PR, or release copy.
