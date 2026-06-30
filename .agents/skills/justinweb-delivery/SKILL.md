---
name: justinweb-delivery
description: "Close out implemented or validated JustinWeb work by calibrating current project facts and preparing Markdown commit information plus PR description. Use only inside the JustinWeb repository."
---

# JustinWeb Delivery

## Shared Context

Read `.agents/skills/README.md`. Inspect Git status, current branch, changed files, relevant diffs, and validation results.

## Documentation Calibration

Scan affected current-fact files only: `CONTEXT.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/README.md`, `docs/work/*`, `docs/develop/*`, `docs/lessons.md`, `src/justin-kit/README.md`, and touched component README files.

## Output

- Default delivery output should be written in Chinese unless the user explicitly requests another language.
- Commit recommendations must use Chinese for the commit subject and body. Conventional Commits prefixes before the colon, such as `feat(works):`, may remain in English.
- Markdown commit recommendation using Conventional Commits when no stronger project rule exists.
- Whenever commit recommendations are provided, also include a deployment flow based on the project's current runtime and deployment facts.
- Before writing deployment steps, identify the actual deployment mode from repository facts. JustinWeb currently deploys with the root `Dockerfile` and `docker-compose.yml`; do not default to `npm run preview`, host-level `npm install`, or non-Docker process restarts for production unless the user says that host is not using Docker.
- Default deployment flow should assume the user has already mounted the project and existing `.env`/`.env.local` are configured; omit `.env` setup unless the current change adds or changes environment variables. Start the default flow from the deployed host with `cd <deployed project>` and `git pull --ff-only`.
- For the current Docker deployment, use the user's normal production command: `docker compose --profile backup up -d --build --force-recreate`. Then verify with `docker compose ps`, `docker compose logs --tail=80 justinweb`, and `curl -fsS http://127.0.0.1:4321/api/health`.
- If the user explicitly asks for a redeploy or says the service needs to be redeployed from scratch, provide the fuller redeploy flow starting from the local project `cd <repo>` and `git push`, then continue with the deployed host Docker steps.
- Markdown PR description with overview, implementation, validation, risks, rollback, docs, and review focus.
- Documentation and changelog updates made or intentionally not needed.
- Remaining risks.

Do not create formal version release documents; route those to `justinweb-release`. Do not perform Git writes unless explicitly requested.
