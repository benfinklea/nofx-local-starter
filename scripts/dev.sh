#!/usr/bin/env bash
set -euo pipefail
export DEV_RESTART_WATCH="${DEV_RESTART_WATCH:-0}"
if [ "${DEV_RESTART_WATCH}" = "1" ]; then
  echo "[dev.sh] DEV_RESTART_WATCH=1 detected. This script will ignore it to avoid runaway respawns." >&2
fi

DEV_RESTART_WATCH=0 npm run dev:api &
CP=$!
DEV_RESTART_WATCH=0 npm run dev:worker &
WT=$!
trap "kill $CP $WT" INT TERM
wait
