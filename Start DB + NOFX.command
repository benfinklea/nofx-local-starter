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
(cd apps/frontend && npm install --silent) || true

echo "Starting NOFX API + Worker (dev) and Frontend (MUI) ..."
export QUEUE_DRIVER=memory

# Kill Vite dev server if running (5173)
if command -v lsof >/dev/null 2>&1; then
  VITE=$(lsof -ti tcp:5173 -sTCP:LISTEN || true)
  if [ -n "${VITE:-}" ]; then
    echo "Killing processes on :5173 ($VITE)"
    kill $VITE 2>/dev/null || true
    sleep 1
    kill -9 $VITE 2>/dev/null || true
  fi
fi

# Start backend (API + Worker) and Frontend in background panes
npm run dev &
(cd apps/frontend && npm run dev) &

sleep 2
echo "Opening NOFX MUI app (auto-login)..."
open "http://localhost:5173/dev/login?next=/ui/app/" || open "http://localhost:5173/ui/app/" || open "http://localhost:5173" || true
echo "All services starting. This window will show logs."
wait
