# JustinWeb Project Skills

These skills serve this repository only.

## Project Skill Rules

- Project-local skills live in `.agents/skills/`.
- Skill names use the `justinweb-` prefix.
- Individual skill folders contain only `SKILL.md` and `agents/openai.yaml`.
- Add, remove, merge, or rename a skill only with matching updates to this index and `justinweb-workflow`.
- Temporary plans, release drafts, and worktrees use `.workspace/`.
- Confirmed durable facts live in `CONTEXT.md`, `CHANGELOG.md`, `README.md`, `docs/`, and component README files.

## Shared Pre-read Protocol

### Level 1: Project Facts

Read these before routing or changing workflow-sensitive files:

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/README.md`
- `docs/work/active.md`
- `docs/work/backlog.md`
- `docs/work/decisions.md`
- `docs/develop/workflow.md`

### Level 2: Relevant Domain Facts

Read only the files tied to the request:

- `src/justin-kit/README.md`
- `src/justin-kit/components/*/README.md`
- `docs/plans/`
- `docs/lessons.md`
- `src/data/kit.ts`

### Level 3: Relevant Source And Tests

Use targeted search before opening files. Common source surfaces:

- `src/pages/index.astro`
- `src/styles/global.css`
- `src/pages/api/activity/`
- `src/justin-kit/components/`
- `public/os-desktop/`

There is no separate test suite yet. Use `rtk npm run build` as the baseline automated check and add focused validation when behavior changes.

### Level 4: Git Facts

Read Git status, branch, diffs, and recent log for validation, delivery, release work, or explicit Git requests. Preserve unrelated user changes.

## Skill Router

| User intent | Skill | Main output |
| --- | --- | --- |
| Unsure which project skill applies or asks for full workflow | `justinweb-workflow` | Ordered route |
| Discuss candidate requirements or update backlog after confirmation | `justinweb-requirement-pool` | Backlog row or duplicate analysis |
| Analyze current behavior, state flow, dependencies, or boundaries | `justinweb-feature-analysis` | Evidence-backed analysis |
| Compare options and define tasks before implementation | `justinweb-feature-plan` | Scoped plan and validation boundary |
| Implement accepted code, docs, scripts, or project-local skills | `justinweb-implementation` | Working-tree changes |
| Validate, review, run checks, diagnose failures, and re-check | `justinweb-validation` | Validation report |
| Calibrate docs and prepare commit or PR handoff | `justinweb-delivery` | Commit information and PR description |
| Write a formal release document for a specified version | `justinweb-release` | Release document draft or file |
| Maintain this project-local skill matrix | `justinweb-skill-create` | Updated skills and routing docs |

## Recommended Flows

- Small fix: `justinweb-implementation` -> `justinweb-validation`.
- New feature: `justinweb-requirement-pool` -> `justinweb-feature-analysis` -> `justinweb-feature-plan` -> `justinweb-implementation` -> `justinweb-validation` -> `justinweb-delivery`.
- Documentation-only calibration: `justinweb-feature-analysis` -> `justinweb-implementation` -> `justinweb-validation`.
- Skill system maintenance: `justinweb-skill-create` -> `justinweb-validation` -> `justinweb-delivery`.

## Common Gates

- Confirm before adding or changing backlog rows.
- Require accepted scope before implementation unless the user asks for end-to-end execution.
- Do not stage, commit, push, tag, publish, or delete branches without explicit instruction.
- Keep `.workspace/` temporary and uncommitted.
- If docs and source disagree, trust the source and update docs during delivery.
