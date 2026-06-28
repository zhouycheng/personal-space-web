#!/usr/bin/env bash
set -euo pipefail

MAX_AGE_SECONDS="${BACKUP_HEALTH_MAX_AGE_SECONDS:-7200}"
STATUS_FILE="/backups/status/last-local-success"

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "No successful local backup has completed" >&2
  exit 1
fi

NOW="$(date +%s)"
LAST_SUCCESS="$(cat "$STATUS_FILE")"
AGE="$((NOW - LAST_SUCCESS))"
if (( AGE > MAX_AGE_SECONDS )); then
  echo "Latest local backup is ${AGE}s old" >&2
  exit 1
fi
