#!/usr/bin/env bash
set -euo pipefail

# CI E2E runner: builds FE, starts API+Worker, installs browsers, runs Playwright

export NODE_ENV=test
export QUEUE_DRIVER=memory
export DATA_DRIVER=fs

echo "Installing root deps"
npm ci

echo "Installing frontend deps"
npm --prefix apps/frontend ci

echo "Building frontend"
npm run fe:build

echo "Starting API and Worker"
DEV_RESTART_WATCH=0 npm run dev:api &
API_PID=$!
DEV_RESTART_WATCH=0 npm run dev:worker &
WORKER_PID=$!

cleanup(){
  echo "Stopping services"; kill $API_PID $WORKER_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for API health"
for i in {1..60}; do
  if curl -sf http://localhost:3000/health >/dev/null ; then echo "API up"; break; fi
  sleep 1
done

export PW_BASE_URL=http://localhost:3000

echo "Installing Playwright browsers"
npx playwright install --with-deps

echo "Running Playwright E2E"
npx playwright test --reporter=list tests/e2e

