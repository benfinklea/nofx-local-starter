#!/usr/bin/env bash
set -euo pipefail

LOG_PREFIX="[NOFX]"

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$1"
}

# Ensure we are in the repository root
cd "$(dirname "$0")"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

if [ "${DEV_RESTART_WATCH:-0}" = "1" ]; then
  log 'DEV_RESTART_WATCH=1 detected; resetting to 0 for background launch safety'
fi
export DEV_RESTART_WATCH=0

require_cmd node
require_cmd npm
require_cmd curl

SUPABASE_CMD=(supabase)
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found; falling back to npx (no global install required)."
  SUPABASE_CMD=(npx --yes supabase)
fi

supabase_cmd() {
  "${SUPABASE_CMD[@]}" "$@"
}

log '🔍 Checking Supabase local stack (supabase status)'
# Try multiple methods to check Docker
if docker ps >/dev/null 2>&1 || docker version >/dev/null 2>&1; then
  if supabase_cmd status >/dev/null 2>&1; then
    log 'Supabase stack already running'
  else
    log 'Starting Supabase stack'
    supabase_cmd start
  fi
else
  log '⚠️  Docker is not accessible - skipping Supabase'
  log '   To use Supabase, ensure Docker Desktop is running'
  log '   You may need to restart Docker Desktop or run: docker context use desktop-linux'
fi

log '📦 Installing repo dependencies (npm install)'
npm install || npm install
if [ -f apps/frontend/package.json ]; then
  log '📦 Installing frontend dependencies (apps/frontend)'
  (cd apps/frontend && (npm install || npm install))
fi

export QUEUE_DRIVER="${QUEUE_DRIVER:-memory}"
export REDIS_URL="${REDIS_URL:-memory}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:50000/postgres}"
export VITE_HOST="${VITE_HOST:-0.0.0.0}"
export VITE_PORT="${VITE_PORT:-5173}"

log '🧹 Cleaning up old dev processes'
# More aggressive cleanup - kill processes on specific ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
# Also cleanup by process pattern
pkill -f "ts-node-dev.*src/api/main.ts" 2>/dev/null || true
pkill -f "ts-node-dev.*src/worker/main.ts" 2>/dev/null || true
pkill -f "node .*apps/frontend" 2>/dev/null || true
# Give processes time to die
sleep 2

start_proc() {
  local cmd="$1"
  local label="$2"
  echo "  • ${label}" >&2
  echo "    ↪ ${cmd}" >&2

  # Start the process in background
  bash -lc "$cmd" > /tmp/nofx-${label//[^a-zA-Z0-9]/-}.log 2>&1 &
  local pid=$!

  # Check if process actually started
  sleep 0.5
  if kill -0 $pid 2>/dev/null; then
    echo "    ↪ PID ${pid} - Started successfully" >&2
    echo $pid  # Return PID to stdout for capture
    return 0
  else
    echo "    ⚠️  Failed to start ${label}" >&2
    return 1
  fi
}

log '🚀 Launching NOFX services…'
API_PID=$(start_proc "npm run dev:api" "API (http://localhost:3000)" || echo "")
if [ -z "${API_PID}" ]; then
  log "⚠️  Failed to start API server"
  exit 1
fi

WORKER_PID=$(start_proc "npm run dev:worker" "Worker queue" || echo "")
if [ -z "${WORKER_PID}" ]; then
  log "⚠️  Failed to start Worker process"
  kill ${API_PID} 2>/dev/null || true
  exit 1
fi

FRONT_PID=""
if [ -f apps/frontend/package.json ]; then
  FRONT_PID=$(start_proc "cd apps/frontend && npm run dev -- --host ${VITE_HOST} --port ${VITE_PORT}" \
    "Vite frontend (http://${VITE_HOST}:${VITE_PORT})" || echo "")
  if [ -z "${FRONT_PID}" ]; then
    log "⚠️  Failed to start Frontend"
    kill ${API_PID} 2>/dev/null || true
    kill ${WORKER_PID} 2>/dev/null || true
    exit 1
  fi
fi

log "   ↳ API pid=${API_PID}, worker pid=${WORKER_PID}, frontend pid=${FRONT_PID}"

log '⏱  Allowing processes to warm up (3s)'
sleep 3

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local sleep_time="${4:-1}"
  printf '%s ⏳ Waiting for %s' "$LOG_PREFIX" "${label}"
  for ((i=0; i<attempts; i++)); do
    if curl --silent --fail --max-time 2 "$url" >/dev/null 2>&1; then
      printf ' ready\n'
      return 0
    fi
    printf '.'
    sleep "${sleep_time}"
  done
  printf ' giving up after %s attempts\n' "${attempts}"
  return 1
}

API_URL="http://127.0.0.1:3000/health"
wait_for_http "${API_URL}" "API" 60 1 || true

if [ -n "${FRONT_PID}" ]; then
  FRONT_URL="http://127.0.0.1:${VITE_PORT}"
  wait_for_http "${FRONT_URL}" "Frontend" 60 1 || true

  log "🌐 Opening frontend in browser (${FRONT_URL})"
  open "${FRONT_URL}/dev/login?next=/ui/app/" \
    || open "${FRONT_URL}/ui/app/" \
    || open "${FRONT_URL}" \
    || true
fi

log '🌐 Opening legacy runs dashboard (http://127.0.0.1:3000/ui/runs)'
open "http://127.0.0.1:3000/ui/runs" || true

log '✅ NOFX local environment is starting. Logs will stream below.'

tshutdown() {
  echo ""
  log "♻️  Stopping dev processes…"

  # Kill processes gracefully first
  [ -n "${API_PID}" ] && kill ${API_PID} 2>/dev/null || true
  [ -n "${WORKER_PID}" ] && kill ${WORKER_PID} 2>/dev/null || true
  [ -n "${FRONT_PID}" ] && kill ${FRONT_PID} 2>/dev/null || true

  # Give them time to shutdown gracefully
  sleep 1

  # Force kill if still running
  [ -n "${API_PID}" ] && kill -9 ${API_PID} 2>/dev/null || true
  [ -n "${WORKER_PID}" ] && kill -9 ${WORKER_PID} 2>/dev/null || true
  [ -n "${FRONT_PID}" ] && kill -9 ${FRONT_PID} 2>/dev/null || true

  # Clean up port bindings
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true

  log "✅ Cleanup complete"
}

trap tshutdown EXIT INT TERM

# Wait for processes with error checking
while true; do
  # Check if processes are still running
  if [ -n "${API_PID}" ] && ! kill -0 ${API_PID} 2>/dev/null; then
    log "⚠️  API process died unexpectedly"
    exit 1
  fi
  if [ -n "${WORKER_PID}" ] && ! kill -0 ${WORKER_PID} 2>/dev/null; then
    log "⚠️  Worker process died unexpectedly"
    exit 1
  fi
  if [ -n "${FRONT_PID}" ] && ! kill -0 ${FRONT_PID} 2>/dev/null; then
    log "⚠️  Frontend process died unexpectedly"
    exit 1
  fi
  sleep 5
done
