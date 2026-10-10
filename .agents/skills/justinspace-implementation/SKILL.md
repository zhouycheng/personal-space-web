---
name: justinspace-implementation
description: "Implement confirmed JustinSpace changes with validation scoped to affected behavior, preserving project boundaries and existing work; route skill maintenance to justinspace-skill-create."
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

- Select the minimum sufficient checks for the changed behavior and affected callers using `AGENTS.md` and `docs/develop/workflow.md`. Explain the concrete impact or failure that requires broader checks; a shared file or task completion is not a reason to run a full suite.
- For docs and skills, check content, links, metadata and skill format only. For mixed test files, select relevant test names; for E2E, also select the browser project and ensure the service contains the current changes.
- Reuse matching, verifiable results. Ordinary implementation ends after the relevant checks and report; use `justinspace-delivery` only when the task calls for its review, validation report or handoff, preserving the same check scope.
- Report the changed files, behavior, checks actually run, and any unverified behavior.
- Do not stage, commit, push, release, or deploy unless the user explicitly asks for that action.
