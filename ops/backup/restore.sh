#!/usr/bin/env bash
set -euo pipefail

SOURCE="${1:-local}"
SNAPSHOT="${2:-latest}"
TARGET="${3:-/restore/$(date -u +%Y%m%dT%H%M%SZ)}"
APPLY_MODE="${4:-}"

if [[ "$SOURCE" == "remote" ]]; then
  REPOSITORY="${RESTIC_REMOTE_REPOSITORY:?RESTIC_REMOTE_REPOSITORY is required}"
  PASSWORD_FILE="${RESTIC_REMOTE_PASSWORD_FILE:-/run/secrets/restic_remote_password}"
else
  REPOSITORY="${RESTIC_LOCAL_REPOSITORY:-/backups/restic}"
  PASSWORD_FILE="${RESTIC_LOCAL_PASSWORD_FILE:-/run/secrets/restic_local_password}"
fi

mkdir -p "$TARGET"
restic -r "$REPOSITORY" --password-file "$PASSWORD_FILE" restore "$SNAPSHOT" --target "$TARGET"
RESTORED_DB="$(find "$TARGET" -name canvas.db -type f | head -n 1)"
if [[ -z "$RESTORED_DB" ]]; then
  echo "[restore] canvas.db not found in snapshot" >&2
  exit 1
fi
if [[ "$(sqlite3 "$RESTORED_DB" 'PRAGMA integrity_check;')" != "ok" ]]; then
  echo "[restore] restored database failed integrity check" >&2
  exit 1
fi

echo "[restore] verified restore at $TARGET"

if [[ "$APPLY_MODE" == "--apply" ]]; then
  if [[ "${CANVAS_RESTORE_CONFIRM:-}" != "WEB_SERVICE_IS_STOPPED" ]]; then
    echo "[restore] refusing to apply: stop the web service and set CANVAS_RESTORE_CONFIRM=WEB_SERVICE_IS_STOPPED" >&2
    exit 1
  fi
  if [[ ! -w /data ]]; then
    echo "[restore] refusing to apply: /data is mounted read-only" >&2
    exit 1
  fi
  BEFORE_RESTORE="/data/canvas.db.before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
  if [[ -f /data/canvas.db ]]; then
    sqlite3 /data/canvas.db ".backup '$BEFORE_RESTORE'"
  fi
  cp "$RESTORED_DB" /data/canvas.db.next
  mv /data/canvas.db.next /data/canvas.db
  RESTORED_ASSETS="$(find "$TARGET" -type d -name canvas-assets | head -n 1)"
  if [[ -n "$RESTORED_ASSETS" ]]; then
    mkdir -p /data/canvas-assets
    cp -a "$RESTORED_ASSETS/." /data/canvas-assets/
  fi
  echo "[restore] applied verified snapshot; previous database retained at $BEFORE_RESTORE"
else
  echo "[restore] production data was not modified; pass --apply only after stopping the web service"
fi
