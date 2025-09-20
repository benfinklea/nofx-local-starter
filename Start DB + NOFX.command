#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in the repository root
cd "$(dirname "$0")"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd supabase
require_cmd node
require_cmd npm

printf '🔍 Checking Supabase local stack…'
if supabase status >/dev/null 2>&1; then
  printf ' already running\n'
else
  printf ' starting\n'
  supabase start
fi

printf '📦 Installing dependencies (if needed)…\n'
npm install >/dev/null 2>&1 || npm install
if [ -f apps/frontend/package.json ]; then
  (cd apps/frontend && (npm install >/dev/null 2>&1 || npm install))
fi

export QUEUE_DRIVER="${QUEUE_DRIVER:-memory}"

printf '🧹 Cleaning up old dev processes\n'
pkill -f "ts-node-dev.*src/api/main.ts" 2>/dev/null || true
pkill -f "ts-node-dev.*src/worker/main.ts" 2>/dev/null || true
pkill -f "node .*apps/frontend" 2>/dev/null || true

start_proc() {
  local cmd="$1"
  local label="$2"
  echo "  • ${label}"
  bash -lc "$cmd" &
  echo $!
}

echo "🚀 Launching NOFX services…"
API_PID=$(start_proc "npm run dev:api" "API (http://localhost:3000)")
WORKER_PID=$(start_proc "npm run dev:worker" "Worker queue")
FRONT_PID=""
if [ -f apps/frontend/package.json ]; then
  FRONT_PID=$(start_proc "cd apps/frontend && npm run dev" "Vite frontend (http://localhost:5173)")
fi

sleep 3

if [ -n "${FRONT_PID}" ]; then
  open "http://localhost:5173/dev/login?next=/ui/app/" \
    || open "http://localhost:5173/ui/app/" \
    || open "http://localhost:5173" \
    || true
fi

open "http://localhost:3000/ui/runs" || true

echo "✅ NOFX local environment is starting. Logs will stream below."

tshutdown() {
  echo "\n♻️  Stopping dev processes…"
  kill ${API_PID} 2>/dev/null || true
  kill ${WORKER_PID} 2>/dev/null || true
  if [ -n "${FRONT_PID}" ]; then
    kill ${FRONT_PID} 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap tshutdown EXIT

wait
