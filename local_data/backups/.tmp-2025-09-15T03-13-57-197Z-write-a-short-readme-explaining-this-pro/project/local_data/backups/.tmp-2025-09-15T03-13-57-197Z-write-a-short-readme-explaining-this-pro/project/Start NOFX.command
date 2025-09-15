#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node 20+ from nodejs.org"; exit 1;
fi
echo "Installing dependencies (first run may take a minute)..."
npm install --silent || true
echo "Starting NOFX in simple mode (one process, in-memory queue)..."
export QUEUE_DRIVER=memory
npm start
