#!/usr/bin/env bash
set -euo pipefail
export DEV_RESTART_WATCH="${DEV_RESTART_WATCH:-0}"
if [ "${DEV_RESTART_WATCH}" = "1" ]; then
  echo "[dev.sh] DEV_RESTART_WATCH=1 detected. This script will ignore it to avoid runaway respawns." >&2
fi

DEV_RESTART_WATCH=0 pnpm --filter @nofx/control-plane dev &
CP=$!
DEV_RESTART_WATCH=0 pnpm --filter @nofx/worker-ts dev &
WT=$!
trap "kill $CP $WT" INT TERM
wait
