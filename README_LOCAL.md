# NOFX — Local-First Starter (Mac)

Fast path to run a single-tenant control plane + worker locally with **Supabase CLI**. Migrate to Supabase Cloud later with `supabase link && supabase db push`.

## AI Contributor Note
- Any automation or AI assistant (including Codex) must read `AI_CODER_GUIDE.md` before making changes in this repository.

## Prereqs
- macOS with Docker Desktop
- Node 20+
- Supabase CLI: `brew install supabase/tap/supabase`
- Redis (Docker is fine)
- Optional: Python 3.11 (for future py worker)

## 1) Start Supabase locally
```bash
supabase init   # if first time in this repo
supabase start  # spins up local Postgres, Auth, Storage
# Grab connection strings and keys
supabase status
```

## 2) Configure env
Copy `.env.example` to `.env` and fill values from `supabase status`.
```bash
cp .env.example .env
```

## 3) Apply schema
```bash
# Uses Supabase migrations folder provided in this repo
supabase db reset  # drops & recreates, applies migrations
```

## 4) Easiest: Simple Mode (one process)
No Redis. No Supabase. Worker runs inside the API using an in‑memory queue and local filesystem storage under `local_data/`.
```bash
npm install
npm start
```

Mac users can double‑click `Start NOFX.command`.

## 5) Install & run (advanced)
If you prefer separate processes and Redis:
```bash
docker run --rm -d --name nofx-redis -p 6379:6379 redis:7-alpine
npm run dev  # runs control-plane and worker concurrently
```
```bash
npm install
npm run dev  # runs control-plane and worker concurrently
```

## 6) Smoke test
Create a run:
```bash
curl -s -X POST http://localhost:3000/runs \
  -H 'Content-Type: application/json' \
  -d '{"plan":{"goal":"hello-world","steps":[{"name":"hello","tool":"manual:approve","inputs":{}}]}}' | jq
```
Check timeline:
```bash
curl -s http://localhost:3000/dev/queue | jq
curl -s http://localhost:3000/dev/worker/health | jq
```

## Notes
- Queue uses an in-memory queue in Simple Mode. In advanced mode it uses **BullMQ** with Redis.
- Storage uses Supabase Storage buckets. Artifacts land in `artifacts/` bucket.
- No multi-tenancy; `tenant_id` defaults to `'local'`.
- RLS off for local simplicity. Enable RLS + row policies when moving to cloud.
- Keep `DEV_RESTART_WATCH=0` for `Start *.command` launchers, CI, or any `nohup`/background sessions. Enable it only when you are in an interactive terminal and need `ts-node-dev` to recycle the process.

## Troubleshooting
- API up: `curl -s http://localhost:3000/health` should return `{ ok: true }`.
- Redis ping: `curl -s http://localhost:3000/dev/redis` should be `ok: true`.
- Worker heartbeat: `curl -s http://localhost:3000/dev/worker/health` shows `healthy: true` when worker is running.
- Queue counts: `curl -s http://localhost:3000/dev/queue` shows waiting/active counts for `step.ready`.

## Backups
- Manual backup: Settings → Backups → Backup Now (optional note).
- Restore: Settings → Backups → Restore.
- Where they go: `local_data/backups/*.tar.gz` with a sidecar JSON metadata file. If Supabase Storage is configured, a copy is uploaded under `artifacts/backups/`.
- CLI alternative: `curl -X POST http://localhost:3000/backups` (admin cookie required).
- Scope options: Data only (NOFX runs/settings/artifacts), or Data + Project (repository working tree, excluding `node_modules` and `.git`). Choose in Settings.
