#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_PREFIX="[bootstrap]"
log() {
  printf '%s %s\n' "$LOG_PREFIX" "$1"
}

fail() {
  printf '%s ERROR: %s\n' "$LOG_PREFIX" "$1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing dependency: $1"
  fi
}

if [[ "${DEV_RESTART_WATCH:-0}" == "1" ]]; then
  log 'DEV_RESTART_WATCH=1 detected; forcing to 0 for non-interactive bootstrap.'
fi
export DEV_RESTART_WATCH=0
export DEV_RESTART_ALLOW_HEADLESS=0

require_cmd node
require_cmd npm

SUPABASE_CMD=(supabase)
if ! command -v supabase >/dev/null 2>&1; then
  log 'Supabase CLI not found; falling back to npx supabase (requires npm registry access).'
  SUPABASE_CMD=(npx --yes supabase)
fi

supabase_cmd() {
  "${SUPABASE_CMD[@]}" "$@"
}

if ! supabase_cmd --help >/dev/null 2>&1; then
  fail 'Supabase CLI is unavailable. Install the Supabase CLI before running bootstrap.'
fi

log 'Checking Supabase local stack'
if ! supabase_cmd status >/dev/null 2>&1; then
  log 'Starting Supabase stack (this may take a minute)'
  supabase_cmd start
else
  log 'Supabase stack already running'
fi

log 'Resetting Supabase database (fresh schema)'
if ! supabase_cmd db reset --non-interactive >/dev/null 2>&1; then
  log 'Interactive reset required (accept prompt to continue)'
  supabase_cmd db reset
fi

STATUS_JSON=""
if STATUS_JSON=$(supabase_cmd status --json 2>/dev/null); then
  :
else
  STATUS_JSON=""
fi

ENV_FILE=".env"
if [[ ! -f "$ENV_FILE" ]]; then
  log 'Creating .env from template (.env.example)'
  cp .env.example "$ENV_FILE"
fi

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  [[ -z "$value" ]] && return 0
  node - <<'NODE' "$file" "$key" "$value"
const fs = require('fs');
const [,, file, key, value] = process.argv;
const line = `${key}=${value}`;
let text = '';
if (fs.existsSync(file)) {
  text = fs.readFileSync(file, 'utf8');
}
const pattern = new RegExp(`^${key}=.*$`, 'm');
if (pattern.test(text)) {
  text = text.replace(pattern, line);
} else {
  if (text.length && !text.endsWith('\n')) text += '\n';
  text += line + '\n';
}
fs.writeFileSync(file, text);
NODE
}

if [[ -n "$STATUS_JSON" ]]; then
  log 'Syncing Supabase environment variables into .env'
  while IFS='=' read -r key value; do
    [[ -z "$key" || -z "$value" ]] && continue
    upsert_env_var "$ENV_FILE" "$key" "$value"
  done < <(printf '%s' "$STATUS_JSON" | node - <<'NODE' 2>/dev/null || true
const fs = require('fs');
const data = fs.readFileSync(0, 'utf8');
if (!data.trim()) process.exit(0);
try {
  const status = JSON.parse(data);
  const env = status.localEnv || status.env || status.projectEnv || {};
  const services = status.services || {};
  const db = services.db || {};
  const api = services.api || {};
  const output = {
    DATABASE_URL: env.DATABASE_URL || db.connectionString || db.url || '',
    SUPABASE_URL: env.SUPABASE_URL || api.url || api.restUrl || '',
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || api.anonKey || '',
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || api.serviceRoleKey || ''
  };
  for (const [key, value] of Object.entries(output)) {
    if (value) {
      console.log(`${key}=${value}`);
    }
  }
} catch (err) {
  process.exit(0);
}
NODE
  )
else
  log 'Could not parse Supabase status JSON; please verify .env manually.'
fi

log 'Installing backend dependencies (npm install)'
npm install

if [[ -f apps/frontend/package.json ]]; then
  log 'Installing frontend dependencies (apps/frontend)'
  (cd apps/frontend && npm install)
fi

log 'Ensuring Supabase storage bucket exists'
npm run create:bucket

log 'Running Jest API smoke test (tests/api/health.test.ts)'
npm run test:api -- --runTestsByPath tests/api/health.test.ts

log 'Bootstrap complete! Your local stack is ready.'
