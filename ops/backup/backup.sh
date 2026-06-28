#!/usr/bin/env bash
set -euo pipefail

SOURCE_DB="${CANVAS_DB_PATH:-/data/canvas.db}"
SOURCE_ASSETS="${CANVAS_ASSET_DIR:-/data/canvas-assets}"
LOCAL_REPOSITORY="${RESTIC_LOCAL_REPOSITORY:-/backups/restic}"
REMOTE_REPOSITORY="${RESTIC_REMOTE_REPOSITORY:-}"
LOCAL_PASSWORD_FILE="${RESTIC_LOCAL_PASSWORD_FILE:-/run/secrets/restic_local_password}"
REMOTE_PASSWORD_FILE="${RESTIC_REMOTE_PASSWORD_FILE:-/run/secrets/restic_remote_password}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE="$(mktemp -d "/tmp/justinweb-backup-${STAMP}.XXXXXX")"

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

if [[ ! -f "$SOURCE_DB" ]]; then
  echo "[backup] source database does not exist: $SOURCE_DB" >&2
  exit 1
fi

echo "[backup] creating immutable SQLite snapshot $STAMP"
sqlite3 "$SOURCE_DB" ".backup '$STAGE/canvas.db'"
INTEGRITY="$(sqlite3 "$STAGE/canvas.db" 'PRAGMA integrity_check;')"
if [[ "$INTEGRITY" != "ok" ]]; then
  echo "[backup] integrity check failed: $INTEGRITY" >&2
  exit 1
fi

mkdir -p "$STAGE/canvas-assets"
if [[ -d "$SOURCE_ASSETS" ]]; then
  cp -a "$SOURCE_ASSETS/." "$STAGE/canvas-assets/"
fi

DB_SHA="$(sha256sum "$STAGE/canvas.db" | awk '{print $1}')"
ASSET_COUNT="$(find "$STAGE/canvas-assets" -type f | wc -l | tr -d ' ')"
cat > "$STAGE/manifest.json" <<EOF
{"createdAt":"$STAMP","databaseSha256":"$DB_SHA","assetCount":$ASSET_COUNT,"formatVersion":1}
EOF

init_repository() {
  local repository="$1"
  local password_file="$2"
  if ! restic -r "$repository" --password-file "$password_file" snapshots >/dev/null 2>&1; then
    restic -r "$repository" --password-file "$password_file" init
  fi
}

backup_repository() {
  local repository="$1"
  local password_file="$2"
  init_repository "$repository" "$password_file"
  restic -r "$repository" --password-file "$password_file" backup "$STAGE" \
    --tag justinweb-canvas --host "${BACKUP_HOST_NAME:-justinweb}"
  restic -r "$repository" --password-file "$password_file" forget \
    --tag justinweb-canvas \
    --keep-hourly "${BACKUP_KEEP_HOURLY:-48}" \
    --keep-daily "${BACKUP_KEEP_DAILY:-30}" \
    --keep-weekly "${BACKUP_KEEP_WEEKLY:-12}" \
    --keep-monthly "${BACKUP_KEEP_MONTHLY:-12}" \
    --prune
}

backup_repository "$LOCAL_REPOSITORY" "$LOCAL_PASSWORD_FILE"
date +%s > /backups/status/last-local-success

if [[ -n "$REMOTE_REPOSITORY" ]]; then
  if ! backup_repository "$REMOTE_REPOSITORY" "$REMOTE_PASSWORD_FILE"; then
    date +%s > /backups/status/last-remote-failure
    echo "[backup] remote backup failed; local snapshot remains valid" >&2
    exit 1
  fi
fi

date +%s > /backups/status/last-success
echo "[backup] completed $STAMP"
