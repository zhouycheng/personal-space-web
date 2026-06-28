#!/usr/bin/env bash
set -euo pipefail

LOCAL_REPOSITORY="${RESTIC_LOCAL_REPOSITORY:-/backups/restic}"
REMOTE_REPOSITORY="${RESTIC_REMOTE_REPOSITORY:-}"
LOCAL_PASSWORD_FILE="${RESTIC_LOCAL_PASSWORD_FILE:-/run/secrets/restic_local_password}"
REMOTE_PASSWORD_FILE="${RESTIC_REMOTE_PASSWORD_FILE:-/run/secrets/restic_remote_password}"

restic -r "$LOCAL_REPOSITORY" --password-file "$LOCAL_PASSWORD_FILE" check
if [[ -n "$REMOTE_REPOSITORY" ]]; then
  restic -r "$REMOTE_REPOSITORY" --password-file "$REMOTE_PASSWORD_FILE" check
fi
