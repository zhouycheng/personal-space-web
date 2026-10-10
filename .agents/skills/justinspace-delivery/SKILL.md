---
name: justinspace-delivery
description: "Review JustinSpace changes and prepare requested validation reports, doc calibration or delivery handoffs, with checks scoped to affected behavior."
---

# JustinSpace Review and Delivery

Read `AGENTS.md` and `.agents/skills/README.md` first. Inspect the branch, worktree, relevant diffs, and accepted scope before reviewing or validating.

## Modes

- **Plan:** choose checks for the changed behavior and affected callers using `AGENTS.md` and `docs/develop/workflow.md`; explain any expansion with concrete impact or failures.
- **Review:** trace affected callers and boundaries; inspect docs, runtime, UI, and unrelated changes. Report findings by severity.
- **Run:** perform only the selected checks. Docs and skills need content, link, metadata and format checks, not application builds or business tests. Select relevant files, test names and browser projects; use build, boundary and type checks independently when needed. Shared flows require affected callers, not an automatic full suite.
- **Closeout:** calibrate changed facts in their owning docs and touched component READMEs; record dated history in `CHANGELOG.md`. Do not broaden review or validation merely because this skill was invoked.

Reuse verifiable results when code, scope and environment still match. New agents, sessions, handoffs and task completion do not trigger reruns. Local full-suite runs require an explicit user request; keep current CI gates and run performance sampling only when requested or needed for a performance claim. Ensure any tested service contains the current changes, building once when matching production artifacts are needed.

For browser or device work, separate automated results, browser observations, and device-dependent behavior that was not exercised. State commands and outcomes exactly; explain failures and report only checks actually completed.

## Handoff

- Report scope, changed behavior, validation evidence, documentation status, and remaining risks.
- For version notes, require the target version; compare the prior relevant tag, `CHANGELOG.md`, and owning docs. Add a dated changelog entry after confirmation, using only verified compatibility, validation, deployment, and risk details.
- For production deployment, follow `docs/develop/deployment.md` and verify the current target and server state before making changes.
- When asked to prepare commit information, use Conventional Commits with a Chinese subject and body. Do not commit unless separately authorized.
- When asked for a PR description, cover the problem, implementation, validation, risks, rollback, docs, and review focus.
- Do not stage, commit, push, tag, publish, or deploy without explicit authorization.
