#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL environment variable required" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_DIR="${REGISTRY_BACKUP_DIR:-./backups}"
mkdir -p "$OUTPUT_DIR"

FILE_PATH="${OUTPUT_DIR}/registry-${TIMESTAMP}.sql"

pg_dump --dbname "$DATABASE_URL" \
  --schema nofx \
  --table nofx.agent_registry \
  --table nofx.agent_versions \
  --table nofx.template_registry \
  --table nofx.template_versions \
  --table nofx.template_usage_daily \
  --table nofx.template_feedback \
  --no-owner --no-privileges > "$FILE_PATH"

echo "Registry backup written to $FILE_PATH"
