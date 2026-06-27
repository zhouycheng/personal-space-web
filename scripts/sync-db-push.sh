#!/usr/bin/env bash
# Push local SQLite database to the server.
# Requires SERVER_HOST and SERVER_DATA_DIR env vars.
set -euo pipefail

LOCAL_DIR="data"
DB_NAME="justinweb.db"
SERVER_HOST="${SERVER_HOST:?Must set SERVER_HOST env var (e.g. user@your-server.com)}"
SERVER_DATA_DIR="${SERVER_DATA_DIR:?Must set SERVER_DATA_DIR env var (e.g. /opt/justinweb/data)}"

echo "==> Checkpointing WAL into main database..."
sqlite3 "${LOCAL_DIR}/${DB_NAME}" "PRAGMA wal_checkpoint(TRUNCATE);"

echo "==> Syncing ${DB_NAME} to ${SERVER_HOST}:${SERVER_DATA_DIR}/"
rsync -avz \
  "${LOCAL_DIR}/${DB_NAME}" \
  "${LOCAL_DIR}/${DB_NAME}-wal" \
  "${LOCAL_DIR}/${DB_NAME}-shm" \
  "${SERVER_HOST}:${SERVER_DATA_DIR}/"

echo "==> Done. Server DB updated."
echo "    Restart the container if needed: docker compose restart"
