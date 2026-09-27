---
name: justinspace-skill-create
description: "Maintain JustinSpace project skills, their shared index, and invocation metadata."
---

# JustinSpace Skill Create

Read `AGENTS.md`, `.agents/skills/README.md`, and the local system skill-creator guide before changing project skills.

## Rules

- Keep skills in `.agents/skills/justinspace-*/`. Each skill folder contains `SKILL.md` and `agents/openai.yaml`, plus only resources required by its workflow.
- Keep names lowercase and hyphenated with the `justinspace-` prefix.
- When creating, removing, merging, renaming, or changing responsibility, update the shared index, affected UI metadata, and stale references in the same change.
- Keep temporary skill experiments in ignored `.workspace/`. Do not create user-level skills unless requested.

## Validation

Run the system `quick_validate.py` for every remaining skill. Confirm folder names match frontmatter, each indexed skill and metadata file exists, and removed names have no stale references.
