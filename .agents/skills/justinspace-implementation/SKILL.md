---
name: justinspace-implementation
description: "Implement confirmed JustinSpace code, content, styles, scripts, and documentation while preserving project boundaries and existing user work; route skill maintenance to justinspace-skill-create."
---

# JustinSpace Implementation

## Before editing

- Read `AGENTS.md`, `.agents/skills/README.md`, the accepted scope, and the files that own the behavior.
- Inspect Git status and diffs. Trace callers when changing shared behavior.
- Use `.node-version` and prefix repository commands with `rtk`.

## Implementation

- Change only the confirmed scope. Reuse existing types, helpers, tests, and project patterns.
- Use `apply_patch` for manual edits. Keep runtime content under its owning `src/content/` path.
- Keep current usage and architecture in their owning README or feature docs. Record dated project history in `CHANGELOG.md`.
- Store short-lived experiments and validation outputs in ignored `.workspace/`; remove generated output when the task is done and it is no longer needed.
- Regenerate a journal package only when the changed content and accepted checks require it. Avoid unrelated formatting and preserve user work.

## Checks and handoff

- Run the checks required by `AGENTS.md` for the changed behavior. Use `justinspace-delivery` for a full review, validation report, or requested delivery handoff.
- Report the changed files, behavior, checks actually run, and any unverified behavior.
- Do not stage, commit, push, release, or deploy unless the user explicitly asks for that action.
