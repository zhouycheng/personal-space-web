---
name: justinweb-requirement-pool
description: "Discuss candidate JustinWeb requirements, check active work and backlog, and after explicit confirmation add or update the local requirement pool. Does not design, plan, or implement features. Use only inside the JustinWeb repository."
---

# JustinWeb Requirement Pool

## Shared Context

Read `.agents/skills/README.md` first. Focus on `CONTEXT.md`, `docs/work/active.md`, `docs/work/backlog.md`, `docs/work/decisions.md`, and related component docs.

## Workflow

1. Restate the candidate using JustinWeb language: `全显状态`, `推拉状态`, `Justin OS 状态`, Justin Kit, local activity, and macOS desktop where relevant.
2. Check for duplicate or active work in `docs/work/backlog.md` and `docs/work/active.md`.
3. Clarify only priority, status, next step, and source when needed.
4. Update `docs/work/backlog.md` only after explicit confirmation.
5. Route accepted analysis to `justinweb-feature-analysis`.

## Backlog Contract

Use columns: `ID | Area | Priority | Status | Candidate | Next step | Source`.

Allowed priority values: `High`, `Medium`, `Low`.

Allowed status values: `Candidate`, `Accepted`, `Blocked`, `Done`, `Dropped`.
