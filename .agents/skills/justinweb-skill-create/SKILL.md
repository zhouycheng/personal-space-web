---
name: justinweb-skill-create
description: "Create, update, merge, delete, rename, or refactor JustinWeb project-local skills while keeping naming, the shared index, UI metadata, and validation consistent. Use only inside the JustinWeb repository."
---

# JustinWeb Skill Create

## Required Guidance

Read `.agents/skills/README.md`. If the system skill creator exists locally, read it before changing project skills.

## Rules

- Keep project skills under `.agents/skills/`.
- Use the `justinweb-` prefix and lowercase hyphen-case names.
- Keep individual skill folders free of README, CHANGELOG, CONTEXT, install guides, and process logs.
- Update the shared index after matrix changes.
- Update `agents/openai.yaml` when responsibility changes.
- Scan for stale old skill names and paths.
- Do not create a user-level skill unless explicitly requested.

## Validation

Run the system `quick_validate.py` for each remaining skill when available. Check that folder names match frontmatter names, every indexed skill exists, each skill has `agents/openai.yaml`, and removed or renamed skills have no stale references.
