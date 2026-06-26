---
name: justinweb-workflow
description: "Lightweight router for JustinWeb project-local skills. Use when the user is unsure which JustinWeb skill applies, asks for the full workflow, or requests work spanning requirements, analysis, planning, implementation, validation, delivery, release documentation, or project skill maintenance."
---

# JustinWeb Workflow Router

Route to the smallest project skill that fits.

## Shared Context

Read `.agents/skills/README.md` first and follow its shared pre-read protocol.

## Router

| User intent | Skill |
| --- | --- |
| Candidate requirement and backlog | `justinweb-requirement-pool` |
| Requirement or existing-feature analysis | `justinweb-feature-analysis` |
| Design, option comparison, tasks, and validation boundaries | `justinweb-feature-plan` |
| Confirmed implementation | `justinweb-implementation` |
| Validation planning, review, checks, and re-verification | `justinweb-validation` |
| Current-fact calibration and commit or PR handoff | `justinweb-delivery` |
| User-specified version release document | `justinweb-release` |
| Project-local skill maintenance | `justinweb-skill-create` |

## Full Workflow

Use the full chain only for explicit end-to-end feature requests.

## Gates

- Require accepted scope before implementation.
- Require explicit instruction for Git writes or publication.
- Keep temporary artifacts in `.workspace/` and durable facts in project docs.
