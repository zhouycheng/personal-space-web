---
name: justinweb-delivery
description: "Close out implemented or validated JustinWeb work by calibrating current project facts and preparing Markdown commit information plus PR description. Use only inside the JustinWeb repository."
---

# JustinWeb Delivery

## Shared Context

Read `.agents/skills/README.md`. Inspect Git status, current branch, changed files, relevant diffs, and validation results.

## Documentation Calibration

Scan affected current-fact files only: `CONTEXT.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/README.md`, `docs/work/*`, `docs/develop/*`, `docs/lessons.md`, `src/justin-kit/README.md`, and touched component README files.

## Output

- Default delivery output should be written in Chinese unless the user explicitly requests another language.
- Commit recommendations must use Chinese for the commit subject and body. Conventional Commits prefixes before the colon, such as `feat(works):`, may remain in English.
- Markdown commit recommendation using Conventional Commits when no stronger project rule exists.
- Markdown PR description with overview, implementation, validation, risks, rollback, docs, and review focus.
- Documentation and changelog updates made or intentionally not needed.
- Remaining risks.

Do not create formal version release documents; route those to `justinweb-release`. Do not perform Git writes unless explicitly requested.
