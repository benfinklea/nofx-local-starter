#!/bin/bash
# Direct worker startup bypassing npm
exec node -r ts-node/register/transpile-only src/worker/main.ts
