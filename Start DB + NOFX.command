#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install via: brew install supabase/tap/supabase"; exit 1;
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node 20+ from nodejs.org"; exit 1;
fi
echo "Stopping previous NOFX app instances (if any)…"
# Try to stop known dev processes cleanly
pkill -f "ts-node-dev.*src/simple.ts" 2>/dev/null || true
pkill -f "ts-node-dev.*src/api/main.ts" 2>/dev/null || true
pkill -f "ts-node-dev.*src/worker/main.ts" 2>/dev/null || true
pkill -f "node .*src/simple.ts" 2>/dev/null || true
pkill -f "node .*src/api/main.ts" 2>/dev/null || true
pkill -f "node .*src/worker/main.ts" 2>/dev/null || true

# Free common app ports (API:3000)
for port in 3000; do
  if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti tcp:$port -sTCP:LISTEN || true)
    if [ -n "${PIDS:-}" ]; then
      echo "Killing processes on :$port ($PIDS)"
      kill $PIDS 2>/dev/null || true
      sleep 1
      kill -9 $PIDS 2>/dev/null || true
    fi
  fi
done

echo "Starting Supabase (local Postgres, Auth, Storage)..."
supabase start || true
echo "Installing dependencies (first run may take a minute)..."
npm install --silent || true
echo "Starting NOFX in simple mode (one process, in-memory queue)..."
export QUEUE_DRIVER=memory
npm start
