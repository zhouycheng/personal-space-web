---
name: justinweb-release
description: "Summarize and discuss changes for a user-specified JustinWeb version, compare Git history with the previous relevant version, and after confirmation write the formal release document. Use only inside the JustinWeb repository."
---

# JustinWeb Release

## Shared Context

Read `.agents/skills/README.md`.

## Version Gate

Require the target version before scanning or writing.

## Workflow

1. Identify the previous relevant tag or version.
2. Scan targeted Git history, `CHANGELOG.md`, release facts, decisions, lessons, and active work.
3. Summarize features, fixes, validation, compatibility, artifacts, and risks.
4. Keep discussion drafts in `.workspace/release-drafts/` when useful.
5. After confirmation, write the formal release document under `docs/releases/vX.Y.Z/release.md`.

## Output

- Default release discussion and formal release documents should be written in Chinese unless the user explicitly requests another language.
- Whenever commit recommendations are provided, also include a deployment flow based on the project's current runtime and deployment facts.
- Default deployment flow should assume the user has already mounted the project and existing `.env` is configured; omit `.env` setup unless the current release adds or changes environment variables. Start the default flow from `cd <deployed project>` and `git pull`.
- If the user explicitly asks for a redeploy or says the service needs to be redeployed from scratch, provide the fuller redeploy flow starting from the local project `cd <repo>` and `git push`, then continue with the deployed host steps.

Do not tag, push, publish, or build artifacts unless explicitly requested.
