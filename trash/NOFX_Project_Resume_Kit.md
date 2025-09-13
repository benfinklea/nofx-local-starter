
# NOFX — Project Resume Kit (Handoff)

## State of play
- **Architecture:** event‑driven **control plane** + worker sandboxes, durable Postgres state, artifacts with provenance, **verification gates**, manual approvals, model routing.
- **Current focus:** single‑tenant, **local-first** on macOS using **Supabase Local** (Postgres/Auth/Storage) + **Redis** queue (BullMQ).
- **Cloud plan (later):** Supabase Cloud + AWS (SQS, Secrets Manager, ECS Fargate).

## What exists (download + purpose)
- **NOFX philosophy v2** — framing + principles → [THE_PHILOSOPHY_OF_NOFX_v2.md](sandbox:/mnt/data/THE_PHILOSOPHY_OF_NOFX_v2.md)  
- **Alpha package** (docs/PRD/architecture/API spec/sprints) → [NOFX_ControlPlane_Alpha_Package.zip](sandbox:/mnt/data/NOFX_ControlPlane_Alpha_Package.zip)  
- **Local starter** (Express API + TS worker + Redis + Supabase Local) → [nofx-local-starter.zip](sandbox:/mnt/data/nofx-local-starter.zip)  
- **Parallel workplan** (agent-safe tasks: base refactor, gates, UI, approvals, router, SQS, DB policy) → [nofx-parallel-workplan.zip](sandbox:/mnt/data/nofx-parallel-workplan.zip)  
- **Test guardrails overlay** (unit-only vitest config + mocks + script) → [nofx-tests-guardrails.zip](sandbox:/mnt/data/nofx-tests-guardrails.zip)

## Rehydrate fast (local)
```bash
# unzip starter into its own folder
mkdir -p ~/code && cd ~/code
unzip -q ~/Downloads/nofx-local-starter.zip -d .
cd nofx-local-starter

# prerequisites
docker --version       # ensure Docker Desktop is running
node -v                # v20+

# start Supabase Local (DB/Auth/Storage)
supabase start

# reset DB to migrations
supabase db reset

# Redis queue
docker run -d --name redis -p 6379:6379 redis:7 || true

# deps + env
npm install
cp .env.example .env
# copy SUPABASE_URL / ANON / SERVICE_ROLE from ./supabase/.env into .env

# create storage bucket
npm run create:bucket

# run API + Worker
npm run dev
open http://localhost:3000/ui/runs  # after you add the UI task, see below
```

## Repo layout (starter)
```
src/
  api/
    main.ts          # Express API (health, /runs, timeline)
    loader.ts        # auto-mounts routers in routes/   (added by 00_BASE task)
    routes/          # add new routers here
  lib/
    db.ts            # Postgres pool
    logger.ts        # pino
    queue/           # adapters (Redis, SQS)            (00_BASE + 50_QUEUE_SQS)
    queue.ts         # shim export (legacy)
    supabase.ts      # storage client
    events.ts        # event recorder
  tools/
    codegen.ts       # uses model router                 (40_MODEL_ROUTER)
  worker/
    main.ts          # queue subscriber
    runner.ts        # dispatch to handlers (plugin)     (00_BASE)
    handlers/        # handlers: codegen, gate, manual, db_write
  ui/                # EJS views + static                (20_UI)
  tests/
    setup.ts         # unit mocks                        (guardrails overlay)
supabase/
  config.toml        # local ports
  migrations/        # 0001_init + later 0002,0003 …
scripts/
  createBucket.ts
  runGate.js         # gate runner                       (10_GATES)
vitest.config.ts     # unit-only config (guardrails)
```

## Run lifecycle (mental model)
1) **Create run** → `POST /runs` with a plan (list of steps).  
2) API writes `run`, `step` rows → emits `step.ready` to queue.  
3) Worker pulls step → dispatches by **handler**:
   - `codegen` → model router → artifact to storage.
   - `gate:*` → runGate → write evidence → pass/fail.
   - `manual:*` → create pending gate → **block** until approved.
   - `db_write` → enforce whitelist → execute DML.
4) Worker updates `steps`, records **events**, and when all steps are done, flips run to `succeeded`.

## Data model (local)
- `nofx.run(id, status, plan, created_at …)`  
- `nofx.step(id, run_id, name, tool, inputs, outputs, status …)`  
- `nofx.artifact(id, step_id, type, uri, hash, created_at …)`  
- `nofx.event(id, run_id, step_id, type, payload, timestamp)`  
- `nofx.gate(id, run_id, step_id, gate_type, status, evidence_uri, approved_by, approved_at)` *(added by 30_APPROVALS)*  
- `nofx.db_write_rule(id, table_name, allowed_ops, constraints)` *(added by 60_DB_WRITE)*

## API (current + planned)
- **Implemented in starter**:  
  - `POST /runs` → create run from plan  
  - `GET /runs/:id` → run + steps + artifacts  
  - `GET /runs/:id/timeline` → events  
- **Added by tasks**:  
  - `GET /ui/runs`, `GET /ui/runs/:id`, `GET /ui/artifacts/signed` *(20_UI)*  
  - `POST /gates` `POST /gates/:id/approve` `POST /gates/:id/waive` `GET /runs/:id/gates` *(30_APPROVALS)*  
- **North star spec** lives in alpha package → `api/OPENAPI.yaml`

## Gates (verification layer)
- **Fast gates for PRs**: `gate:typecheck`, `gate:lint`, `gate:unit`  
- **Changed-lines coverage ≥ 90%** enforced by `scripts/runGate.js` parsing Istanbul output.  
- Evidence written to storage under `runs/<runId>/steps/<stepId>/gate-*.json`.  
- **Manual gates**: `manual:deploy` / `manual:db` → “pending” until approved via API/UI.

## Tests (guardrails)
- **Unit (gated):** `src/**/__tests__/*.unit.test.ts` using Vitest; providers/storage **mocked** in `src/tests/setup.ts`.
- **Not gated:** `tests/integration/**`, `tests/contract/**`, `e2e/**`, `perf/**`, `security/**`, `chaos/**`.
- Commands:  
  - `npm run test:unit`  
  - `npm run test:integration` `test:e2e` `test:perf` `test:security` `test:chaos`

## Model routing
- Adapters: **OpenAI**, **Anthropic**, **Gemini**.  
- Default policy: codegen→OpenAI, reasoning→Anthropic, docs→Gemini; env `LLM_ORDER` can override.  
- Keys read from `.env`; unit tests mock all providers.

## Queue adapters
- **Local:** Redis/BullMQ.  
- **Cloud‑ready:** SQS adapter behind `QUEUE_DRIVER=sqs` (50_QUEUE_SQS).  
- Topic: `step.ready`.

## Storage
- Supabase Storage bucket `artifacts`; signed URLs for UI downloads.
- Later: mirror to S3/Glacier for archive.

## UI
- Minimal EJS console: run list/detail, live timeline refresh, artifact download links.  
- Approvals view can POST to `/gates/:id/approve` (wire buttons later).

## Parallel development playbook
- Apply **parallel workplan**: run `00_BASE` first, then **10,20,30,40,50,60** in parallel.  
- Extension points:
  - API routes live under `src/api/routes/` (auto‑mounted).
  - Worker logic lives under `src/worker/handlers/` (auto‑loaded).
- Migrations use reserved numbers: `0002_gates.sql`, `0003_db_write_policy.sql` to avoid collisions.
- After merges, follow `POST_MERGE.md` from the workplan.

## Commands I’ll reach for after a break
```bash
# stack up
cd ~/code/nofx-local-starter
supabase start
supabase db reset
docker ps | grep redis || docker run -d --name redis -p 6379:6379 redis:7
npm install
npm run create:bucket
npm run dev

# smoke: gated codegen
curl -s -X POST http://localhost:3000/runs -H "Content-Type: application/json" -d '{
  "plan": { "goal": "gated codegen",
    "steps": [
      { "name": "typecheck", "tool": "gate:typecheck" },
      { "name": "lint", "tool": "gate:lint" },
      { "name": "unit", "tool": "gate:unit" },
      { "name": "generate readme", "tool": "codegen", "inputs": { "topic": "Welcome", "bullets": ["Control plane","Verification","Workers"] } }
    ]
  }
}' | jq
open http://localhost:3000/ui/runs
```

## Migration plan to cloud (when ready)
- **DB/Storage/Auth:** `supabase link` → `supabase db push` → create buckets in Studio.  
- **Queue:** flip `QUEUE_DRIVER=sqs`; set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SQS_PREFIX`.  
- **Secrets:** move provider keys to **AWS Secrets Manager**; inject via task role.  
- **RLS & tenancy:** add `tenant_id` to JWT, enable RLS policies; current schema already carries `tenant_id` columns.  
- **Workers:** containerize for Fargate (compose task definitions; not needed locally).

## Decision log (key ADRs)
- **Local-first** single‑tenant using Supabase Local + Redis; cloud later.  
- **Control plane** = single source of truth; DAG; gates; checkpoints.  
- **Verification** baked in; changed-lines coverage 90% min; fail‑closed by default.  
- **Model routing** with fallbacks; usage logged via events.  
- **Manual approvals** on deploy/DB writes.  
- **Queue swap** behind env: Redis now, SQS later.  
- **UI** favors transparency: timeline, artifacts, gate status.

## Known issues / gotchas
- If `supabase db reset` throws **duplicate migration `0001`**, either:
  - `supabase start` then delete the row in `supabase_migrations.schema_migrations` via Studio, or
  - rename your local migration to a fresh timestamp and run reset.
- Docker Desktop must be running or Supabase services won’t start.
- Unit tests must not hit the network—mocks are in place.

## Backlog (near-term)
- Wire UI buttons for approvals; add auth later.
- Add `gate:e2e_smoke` behind a `--risky` flag with ephemeral env stubs.
- Add PR integration (GitHub App + status checks).  
- Add SQS env in CI and run worker against it for a day.  
- Tighten artifact provenance (hashing, SBOM for codegen outputs).

## Glossary
- **Run**: an execution instance of a plan.  
- **Step**: a node in the plan DAG.  
- **Gate**: verification or approval barrier; blocks promotion.  
- **Artifact**: output of a step with URI + hash + metadata.  
- **Lineage**: relationship graph of artifacts across steps.  
- **Handler**: worker plugin that executes a tool.  
- **Evidence**: machine‑readable proof attached to a gate.

## Files to keep handy
- Workplan: [nofx-parallel-workplan.zip](sandbox:/mnt/data/nofx-parallel-workplan.zip)  
- Guardrails: [nofx-tests-guardrails.zip](sandbox:/mnt/data/nofx-tests-guardrails.zip)  
- Starter: [nofx-local-starter.zip](sandbox:/mnt/data/nofx-local-starter.zip)
