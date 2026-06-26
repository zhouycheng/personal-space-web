---
name: justinweb-skill-create
description: "Create, update, merge, delete, rename, or refactor JustinWeb project-local skills while enforcing the justinweb prefix, shared protocol, router, UI metadata, validation, and project-only placement. Use only inside the JustinWeb repository."
---

# JustinWeb Skill Create

## Required Guidance

Read `.agents/skills/README.md`. If the system skill creator exists locally, read it before changing project skills.

## Rules

- Keep project skills under `.agents/skills/`.
- Use the `justinweb-` prefix and lowercase hyphen-case names.
- Keep individual skill folders free of README, CHANGELOG, CONTEXT, install guides, and process logs.
- Update the shared index and `justinweb-workflow` after matrix changes.
- Update `agents/openai.yaml` when responsibility changes.
- Scan for stale old skill names and paths.
- Do not create a user-level skill unless explicitly requested.

## Validation

Run available skill validators and the project workflow matrix validator for broad changes.
