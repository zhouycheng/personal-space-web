# JustinSpace Project Skills

These skills serve this repository only.

## Project Skill Rules

- Project-local skills live in `.agents/skills/`.
- Skill names use the `justinspace-` prefix.
- Individual skill folders contain only `SKILL.md` and `agents/openai.yaml`.
- Keep this index and affected `agents/openai.yaml` metadata aligned with skill changes.
- `.workspace/` is ignored scratch space for temporary plans, experiments, and validation artifacts. Remove generated output when its task is finished.
- Confirmed durable facts live in `CONTEXT.md`, `CHANGELOG.md`, `README.md`, `docs/`, and component README files.

## Shared Context

- Read `AGENTS.md` and this index before using a project skill.
- Follow the ownership map in `AGENTS.md`; use targeted search to select only the relevant docs, source, tests, and component guidance.
- Inspect Git state for validation, delivery, release, skill maintenance, or explicit Git requests. Preserve unrelated user changes.
- Use the Node version recorded in `.node-version` and prefix project commands with `rtk`.
- Select checks for the changed behavior and affected callers according to `AGENTS.md` and `docs/develop/workflow.md`. Invoking a project skill does not expand validation scope.

## Skill Router

| User intent | Skill | Main output |
| --- | --- | --- |
| Maintain canvas content, layout and cards | `justinspace-canvas-content` | Published source files |
| Implement confirmed code, docs, or scripts | `justinspace-implementation` | Working-tree changes |
| Request a review, validation report, doc calibration, version notes, or delivery handoff | `justinspace-delivery` | Scoped validation report, changelog entry, or delivery handoff |
| Maintain this project-local skill matrix | `justinspace-skill-create` | Updated skills and routing docs |

## Recommended Flows

- Confirmed implementation: `justinspace-implementation`, ending after the relevant checks and result report.
- Skill system maintenance: `justinspace-skill-create`, ending after skill format, index and metadata checks.
- Use `justinspace-delivery` when the task calls for its review, report or handoff; do not append it automatically to ordinary implementation or skill maintenance.
- Commit or PR preparation after validation: `justinspace-delivery`.
- Version notes: `justinspace-delivery` -> `CHANGELOG.md`.
- Production deployment: follow [the deployment guide](../../docs/develop/deployment.md) and verify the current server state.

## Common Gates

- Require accepted scope before implementation unless the user asks for end-to-end execution.
- Do not stage, commit, push, tag, publish, or delete branches without explicit instruction.
- Keep `.workspace/` as ignored scratch space; durable facts belong in maintained project docs.
- If docs and source disagree, verify the runtime behavior and update the owning documentation when the task changes current facts.
