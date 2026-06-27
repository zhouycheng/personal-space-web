#!/usr/bin/env bash
# Pull the server SQLite database to local.
# Requires SERVER_HOST and SERVER_DATA_DIR env vars (set in .env or .env.local).
set -euo pipefail

# Load env files
for f in .env .env.local; do
  [ -f "$f" ] && set -a && source "$f" && set +a
done

LOCAL_DIR="data"
DB_NAME="canvas.db"
SERVER_HOST="${SERVER_HOST:?Must set SERVER_HOST env var (e.g. user@your-server.com)}"
SERVER_DATA_DIR="${SERVER_DATA_DIR:?Must set SERVER_DATA_DIR env var (e.g. /opt/justinweb/data)}"

echo "==> Pulling ${DB_NAME} from ${SERVER_HOST}:${SERVER_DATA_DIR}/"
rsync -avz \
  "${SERVER_HOST}:${SERVER_DATA_DIR}/${DB_NAME}" \
  "${SERVER_HOST}:${SERVER_DATA_DIR}/${DB_NAME}-wal" \
  "${SERVER_HOST}:${SERVER_DATA_DIR}/${DB_NAME}-shm" \
  "${LOCAL_DIR}/"

echo "==> Done. Local DB updated."
