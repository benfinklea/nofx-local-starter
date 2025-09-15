#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install via: brew install supabase/tap/supabase"; exit 1;
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node 20+ from nodejs.org"; exit 1;
fi
echo "Starting Supabase (local Postgres, Auth, Storage)..."
supabase start || true
echo "Installing dependencies (first run may take a minute)..."
npm install --silent || true
echo "Starting NOFX in simple mode (one process, in-memory queue)..."
export QUEUE_DRIVER=memory
npm start
