# JustinWeb Project Skills

These skills serve this repository only.

## Project Skill Rules

- Project-local skills live in `.agents/skills/`.
- Skill names use the `justinweb-` prefix.
- Individual skill folders contain only `SKILL.md` and `agents/openai.yaml`.
- Keep this index and affected `agents/openai.yaml` metadata aligned with skill changes.
- Temporary plans, release drafts, and validation artifacts use `.workspace/`.
- Confirmed durable facts live in `CONTEXT.md`, `CHANGELOG.md`, `README.md`, `docs/`, and component README files.

## Shared Context

- Read `AGENTS.md` and this index before using a project skill.
- Follow the ownership map in `AGENTS.md`; use targeted search to select only the relevant docs, source, tests, and component guidance.
- Inspect Git state for validation, delivery, release, skill maintenance, or explicit Git requests. Preserve unrelated user changes.
- Use the Node version recorded in `.node-version` and prefix project commands with `rtk`.

## Skill Router

| User intent | Skill | Main output |
| --- | --- | --- |
| Maintain canvas content, layout and cards | `justinweb-canvas-content` | Published source files |
| Implement confirmed code, docs, or scripts | `justinweb-implementation` | Working-tree changes |
| Validate, review, run checks, diagnose failures, and re-check | `justinweb-validation` | Validation report |
| Calibrate docs and prepare a requested commit or PR handoff | `justinweb-delivery` | Delivery notes, commit information, or PR description |
| Write a formal release document for a specified version | `justinweb-release` | Release document draft or file |
| Maintain this project-local skill matrix | `justinweb-skill-create` | Updated skills and routing docs |
| Deploy or update JustinWeb on a server through Tailscale | `justinweb-tailscale-deploy` | Verified production deployment and rollback state |

## Recommended Flows

- Confirmed implementation: `justinweb-implementation` -> `justinweb-validation`.
- Skill system maintenance: `justinweb-skill-create` -> `justinweb-validation`.
- Commit or PR preparation after validation: `justinweb-delivery`.
- Version release documentation: `justinweb-release`.
- Tailscale server deployment: `justinweb-tailscale-deploy`.

## Common Gates

- Require accepted scope before implementation unless the user asks for end-to-end execution.
- Do not stage, commit, push, tag, publish, or delete branches without explicit instruction.
- Keep `.workspace/` temporary and uncommitted.
- If docs and source disagree, verify the runtime behavior and update the owning documentation when the task changes current facts.
