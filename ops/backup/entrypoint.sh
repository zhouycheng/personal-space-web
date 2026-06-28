#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 0 ]]; then
  exec "$@"
fi

BACKUP_CRON="${BACKUP_CRON:-5 * * * *}"
mkdir -p /backups/status
printf '%s /opt/backup/backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2\n' "$BACKUP_CRON" > /etc/crontabs/root

if [[ "${BACKUP_RUN_ON_START:-true}" == "true" ]]; then
  /opt/backup/backup.sh || true
fi

exec crond -f -l 2
