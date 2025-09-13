# NOFX — Local-First Starter (Mac)

Fast path to run a single-tenant control plane + worker locally with **Supabase CLI**. Migrate to Supabase Cloud later with `supabase link && supabase db push`.

## Prereqs
- macOS with Docker Desktop
- Node 20+ and **pnpm** (`npm i -g pnpm`)
- Supabase CLI: `brew install supabase/tap/supabase`
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

## 4) Install & run
```bash
pnpm install
pnpm dev  # runs control-plane and worker concurrently
```

## 5) Smoke test
Create a run:
```bash
curl -s -X POST http://localhost:3000/runs \
  -H 'Content-Type: application/json' \
  -d '{"plan":{"goal":"hello-world codegen"},"owner":"ben"}' | jq
```
Check timeline:
```bash
curl -s http://localhost:3000/runs | jq
```

## Notes
- Queue uses **pg-boss** (Postgres). Swap to SQS later by replacing `BrokerAdapter`.
- Storage uses Supabase Storage buckets. Artifacts land in `artifacts/` bucket.
- No multi-tenancy; `tenant_id` defaults to `'local'`.
- RLS off for local simplicity. Enable RLS + row policies when moving to cloud.
