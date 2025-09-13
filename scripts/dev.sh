#!/usr/bin/env bash
set -euo pipefail
pnpm --filter @nofx/control-plane dev &
CP=$!
pnpm --filter @nofx/worker-ts dev &
WT=$!
trap "kill $CP $WT" INT TERM
wait
