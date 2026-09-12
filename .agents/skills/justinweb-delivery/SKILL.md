---
name: justinweb-delivery
description: "Close out validated JustinWeb work by calibrating current project facts and preparing user-requested delivery notes, commit information, or PR descriptions. Use only inside the JustinWeb repository."
---

# JustinWeb Delivery

## Shared Context

Read `.agents/skills/README.md`. Inspect Git status, current branch, changed files, relevant diffs, and validation results.

## Documentation Calibration

Scan affected current-fact files only: `CONTEXT.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/README.md`, `docs/work/*`, `docs/develop/*`, `docs/lessons.md`, `src/justin-kit/README.md`, and touched component README files.

## Output

- Report the verified working-tree state, changed behavior, validation evidence, documentation status, and remaining risks.
- When a commit recommendation is requested, use Conventional Commits with a Chinese subject and body; the prefix may remain in English.
- When a PR description is requested, cover the problem, resulting behavior, implementation, validation, material risks, rollback, documentation, and review focus.
- Route production deployment or redeployment requests to `justinweb-tailscale-deploy`.

Do not create formal version release documents; route those to `justinweb-release`. Do not perform Git writes unless explicitly requested.
