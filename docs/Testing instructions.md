# Manual Testing Instructions

## Environment Preparation
1. Install Node.js 20 and (optionally) PostgreSQL. The local stack defaults to an on-disk store when `QUEUE_DRIVER` is `memory`, so you can skip a database for quick checks.
2. Copy `.env.example` to `.env` and populate `OPENAI_API_KEY`. Set `RESPONSES_RUNTIME_MODE=stub` for offline smoke tests; switch to real keys for end-to-end validation.
3. Run `npm install` to install dependencies.
4. If you have the Supabase CLI installed, start backing services with `./Start DB + NOFX.command` (this spins up Supabase, Redis, and background workers). Without the CLI you can skip this step—the app will fall back to the filesystem drivers.
5. Launch the stack with `npm run dev` (API + worker) and, optionally, `npm run fe:dev` for the Vite frontend.

## Sanity Checks
1. Hit `http://localhost:3000/health` and confirm `{ ok: true }`.
2. Visit `http://localhost:3000/ui/responses` to confirm the Responses archive renders (the admin login now redirects here). The
   legacy `/ui/runs` dashboard remains available if you need to inspect orchestration runs.
3. Log in as an admin via `/ui/login` (cookie helper in tests or real auth in prod environments). When running the checks from a
   terminal-only environment you can mint the required `nofx_admin` cookie with:
   ```bash
   node -e "const crypto=require('node:crypto');const secret=process.env.ADMIN_SECRET||process.env.ADMIN_PASSWORD||'dev-secret';const sig=crypto.createHmac('sha256',secret).update('1').digest('hex');console.log(`nofx_admin=1|${sig}`);"
   ```
   Attach the printed cookie value to subsequent `curl` requests with `-H "Cookie: <value>"`.

## Builder → Responses Workflow
1. Navigate to `/ui/builder`.
2. Create a new template using the inline form; set at least one `input_text` field and enable a deployment channel.
3. Click **Run Template**. In stub mode, expect redirected run output with canned assistant text; with live keys, expect real Responses output.
4. Confirm `/ui/responses` now lists the new run with a recent timestamp.
5. Open the run detail page and verify:
   - Assistant output shows the stubbed buffer text (`This is a stubbed Responses run output...`).
   - Raw events include `response.completed`. The stubbed runtime does not emit a `response.created` event; you will only see both events when exercising a live provider.
   - Metadata includes `tenant_id` and template identifiers.
6. Press **Retry Run** and ensure a new run appears with `retried_from` metadata pointing to the original entry.
   > Known issue: manual gates (`manual:*` tools) currently stay in a `running` state even after approval. Approval events fire, but the run never transitions to `succeeded`.

## Operational Dashboards
1. On `/ui/responses`, confirm the summary metrics (total runs, failures in the last 24h, average tokens).
2. Toggle `RESPONSES_ARCHIVE_TTL_DAYS=1`, restart the API, and verify runs older than one day disappear after a refresh. (If no runs are older than the threshold, adjust one of the JSON files under `local_data/responses/` to simulate an older timestamp **before** restarting.)
3. Call `POST /responses/ops/prune` with `{ "days": 1 }` (via `curl` or Postman) and confirm old runs purge while newer ones remain. The endpoint expects a positive integer and will reject fractional values.
4. Check the console logs for rate-limit snapshots when using real API keys (`x-ratelimit-*` values).

## Documentation Archive Integrity
1. For a run with streaming events, stream `/runs/:id/stream` and ensure SSE batches arrive in order.
2. Use `/runs/:id/timeline` to confirm persisted events match those shown in the UI.
3. Validate rollback: replay support is not yet wired in the starter template, so treat this as informational for now.

## Gate and Policy Enforcement
1. Create a plan that includes a manual gate (use a step whose `tool` starts with `manual:` such as `manual:approval`) and confirm `/ui/runs/:id` displays pending approval.
2. Approve and waive the gate to ensure events and badges update correctly. The timeline will show `gate.approved`/`gate.waived`, but the step remains `running` because of the tracked bug below.
3. Trigger a policy violation (tool not in allowlist) and confirm the run fails with `policy.denied` in the timeline.
4. Note: approving or waiving a manual gate currently requeues the step but the follow-up execution never marks the run as complete (tracked bug).

## Regression Suite (Automated)
1. Run `npm run lint` and `npm run typecheck` for static analysis.
2. Execute `npx jest` (set `RESPONSES_RUNTIME_MODE=stub` to avoid network calls).
3. For a full gate, run `npm run gates` (includes SAST, secrets scan, unused code check). The run now completes successfully and writes artifacts to `gate-artifacts/` with the current coverage report; expect a large coverage gap because only the sample Vitest specs execute.

## Production Readiness Checklist
- [ ] Backups: Confirm autobackup settings in `/ui/settings` and that `src/lib/autobackup.ts` writes snapshots.
- [ ] Observability: Verify logs reach the configured sink and that rate-limit telemetry appears in dashboards.
- [ ] Security: Run `npm run test:security` if available and ensure admin routes require authenticated cookies.
- [ ] Documentation: Update release notes with any template or ops workflow changes.
