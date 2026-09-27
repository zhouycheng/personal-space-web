---
name: justinspace-delivery
description: "Plan checks, review JustinSpace changes, run relevant validation, calibrate docs, and prepare requested delivery handoffs."
---

# JustinSpace Review and Delivery

Read `AGENTS.md` and `.agents/skills/README.md` first. Inspect the branch, worktree, relevant diffs, and accepted scope before reviewing or validating.

## Modes

- **Plan:** choose checks that match the changed behavior before implementation.
- **Review:** trace affected callers and boundaries; inspect docs, runtime, UI, and unrelated changes. Report findings by severity.
- **Run:** perform the relevant checks from `AGENTS.md`. Do not run the full suite for a docs-only edit. For shared flows, use the relevant unit tests, build, boundary and type checks.
- **Closeout:** calibrate current facts in `README.md`, `CONTEXT.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/README.md`, affected `docs/develop/` or `docs/features/` files, and touched component READMEs.

For browser or device work, separate automated results, browser observations, and device-dependent behavior that was not exercised. State commands and outcomes exactly; explain failures and report only checks actually completed.

## Handoff

- Report scope, changed behavior, validation evidence, documentation status, and remaining risks.
- For version notes, require the target version; compare the prior relevant tag, `CHANGELOG.md`, and owning docs. Add a dated changelog entry after confirmation, using only verified compatibility, validation, deployment, and risk details.
- For production deployment, follow `docs/develop/deployment.md` and verify the current target and server state before making changes.
- When asked to prepare commit information, use Conventional Commits with a Chinese subject and body. Do not commit unless separately authorized.
- When asked for a PR description, cover the problem, implementation, validation, risks, rollback, docs, and review focus.
- Do not stage, commit, push, tag, publish, or deploy without explicit authorization.
