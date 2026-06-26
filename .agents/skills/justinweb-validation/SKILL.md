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

- Baseline build: `rtk npm run build`.
- Dev preview when needed: `rtk npm run dev` and browser or curl checks.
- Local activity changes: verify environment variables and API route behavior.
- Desktop changes: verify scanner output, window behavior, icon interaction, and responsive layout.

## Output

- Scope checked.
- Commands or manual checks and results.
- Findings ordered by severity.
- Fix and re-run results.
- Residual risks.

Do not prepare commit, PR, or release copy.
