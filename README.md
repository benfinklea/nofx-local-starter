# NOFX — Local Starter (Express + Supabase Local + Redis)

Fast path to a functional control plane on your Mac. Single-tenant, but schema keeps `tenant_id` so we can migrate cleanly.

## 🎉 New: Git-Backed Projects with Progressive Disclosure

NOFX now supports git-backed projects with three experience levels:
- **Hidden Mode** (default) - No git terminology, automatic versioning
- **Basic Mode** - Gentle introduction to version control
- **Advanced Mode** - Full git power for developers

See [Git Projects Guide](docs/GIT_PROJECTS_GUIDE.md) for complete documentation.

## AI Contributor Note
- Any automation or AI assistant (including Codex) must read `AI_CODER_GUIDE.md` before making changes in this repository.

## Prereqs
- Docker Desktop (running)
- Node 20+ (`node -v`)
- Supabase CLI: `brew install supabase/tap/supabase`
- Redis: `docker run -d --name redis -p 6379:6379 redis:7`

## First run
```bash
# 1) Start Supabase Local in this repo (uses ./supabase/)
supabase start

# 2) Apply schema
supabase db reset   # wipes and applies supabase/migrations

# 3) Install deps
npm install

# 4) Copy envs
cp .env.example .env
# Open ./supabase/.env and copy SUPABASE_URL, ANON key, SERVICE_ROLE key into .env

# 5) Create storage bucket
npm run create:bucket

# 6) Run API and Worker (two terminals) or run both:
npm run dev         # runs API on :3000 and worker subscriber
```

## Smoke test
```bash
# new run that asks codegen to write a README artifact
curl -s -X POST http://localhost:3000/runs  -H "Content-Type: application/json"  -d '{
   "plan": {
     "goal": "write README",
     "steps": [
       {"name":"write_readme","tool":"codegen","inputs":{"topic":"Welcome to NOFX","bullets":["Control plane","Verification","Workers"]}}
     ]
   }
 }' | jq
# copy the "id" and check run
curl -s http://localhost:3000/runs/<RUN_ID> | jq
# find artifact path in response, then check Supabase Studio → Storage → artifacts bucket
```

## What’s here
- Express API with `/runs`, `/runs/:id`, `/runs/:id/timeline`
- Redis queue (BullMQ) topic `step.ready`
- Worker executes `codegen` and uploads an artifact to Supabase Storage
- Postgres schema for `run`, `step`, `artifact`, `event` (single-tenant, `tenant_id` defaults to 'local')

## Swap plan later
- Queue: add `SqsQueueAdapter`, set `QUEUE_DRIVER=sqs`
- Secrets: move from `.env` to AWS Secrets Manager
- Multi-tenant: enable RLS policies and tenant JWTs in Supabase Cloud
