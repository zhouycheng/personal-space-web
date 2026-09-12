---
name: justinweb-tailscale-deploy
description: "Deploy or update JustinWeb on a user-owned Linux server reached through Tailscale, preserving runtime data and validating Docker, reverse-proxy, TLS, and public-domain behavior. Use for real server deployments, not local previews or static hosting."
---

# JustinWeb Tailscale Deploy

Deploy the user-confirmed JustinWeb revision through a private Tailscale path and leave a verified, recoverable production state.

## Required Context

Read `.agents/skills/README.md`, `README.md` deployment and data sections, `Dockerfile`, `docker-compose.yml`, `.env.example`, and the current Git state. Read `ops/backup/` only when backup or restore behavior is in scope.

Use the repository's Docker Compose deployment. Do not introduce another hosting platform, process manager, or proxy unless the existing server cannot support the confirmed goal.

## Invocation Inputs

Require the user to provide or explicitly select the invocation-specific target:

- Tailscale MagicDNS name or tailnet IP;
- SSH user and authentication method;
- public domain;
- desired branch, commit, or current working-tree revision;
- the approved boundaries for downtime, restart, cleanup, and rollback.

Discover the remote deployment directory, reverse proxy, certificate owner, and running service scope after connecting when the user has not specified them.

Never hard-code invocation-specific addresses, domains, usernames, emails, key paths, tokens, credentials, private keys, certificate contents, or environment values in this skill or a reusable template. Use user-provided values only for the current deployment and necessary live server configuration. Prefer an existing ignored remote `.env` or the server's secret manager; never print secret files or pass secret values on a command line when a safer existing source is available.

## Preflight

1. Confirm the local branch, revision, working-tree changes, Node version, and intended deployment source. Preserve unrelated changes and do not commit, push, tag, or release without explicit instruction.
2. Run the build and relevant tests with the Node version recorded in `.node-version`.
3. Verify Tailscale reachability and SSH access before mutating the server. Do not silently fall back to public SSH.
4. Inspect the remote OS and architecture, free disk and memory, Docker and Compose versions, current containers, listening ports, reverse-proxy ownership, certificate validity, deployment Git state, bind mounts, and `/api/health`.
5. Identify the exact persistent paths for `.env*`, SQLite, canvas assets, backups, and restore data. A successful container build does not prove those paths are preserved.

## Deployment Decisions

- A normal deployment authorizes building and replacing the JustinWeb Web container in the confirmed directory. It does not authorize restarting the host, changing DNS or firewall rules, deleting data or backups, pruning Docker storage, restoring a database, changing secrets, replacing certificates, or interrupting unrelated services.
- Use `git pull --ff-only` only when the remote checkout is clean and its history permits it. If it is dirty or diverged, do not reset it. Prefer a new release directory and an explicit rollback target, or stop when the correct source cannot be established safely.
- Preserve `.env*`, `data/`, `backups/`, and `restore/` across releases. Never build them into an image or transfer them back to the local workspace.
- Record a recoverable previous image or release before switching production. Remove it only with separate authorization.
- If disk space is low, measure first. Do not delete small backups merely because they are easy to find. Request explicit authorization for the exact cleanup target; unused Docker build cache is distinct from images, volumes, and runtime data.
- If the native build cannot complete, diagnose the failing layer before changing the deployment method. A prebuilt `dist/` overlay is acceptable only when runtime dependencies are compatible and a separate candidate container passes the same health and route checks.

## Deploy And Verify

1. Build without stopping the current Web container when practical.
2. Start a candidate on a private loopback port when the image or release path is uncertain. Use isolated temporary data unless read-only access is sufficient.
3. Require the candidate to pass `/api/health` with `ok: true`, a nonzero desktop entry count, and a healthy database before switching production.
4. Recreate only the confirmed JustinWeb services. Keep the backup service and unrelated containers running unless they are explicitly in scope.
5. Verify the production container health, recent logs, persistent mount source, disk space, and HTTP 200 responses for `/`, `/home`, `/works`, `/canvas`, and `/os`.
6. Verify the reverse proxy locally with the intended Host/SNI value before public testing. Check certificate dates, SAN coverage, and public-key/private-key correspondence before any certificate replacement; validate proxy syntax before reload.
7. Perform the final public HTTPS check without `-k`, disabled certificate checks, or a browser security bypass. Then check the rendered homepage and representative navigation in a real browser.

If the host, SSH, or public site becomes unresponsive, stop concurrent work and re-establish observability. Host restarts and changes affecting other services require a fresh, explicit user decision.

## Handoff

Report the deployed revision or release, public URL, container and health status, certificate expiry, disk state, preserved runtime data, rollback target, checks actually performed, local uncommitted deployment changes, and any remaining risk. Distinguish a healthy backend from a browser-verified public deployment.
