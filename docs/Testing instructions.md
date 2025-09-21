# Manual Testing Instructions

> **Interactive Walkthrough Requirement**: You must personally open a web browser against the running NOFX dev stack and walk the interface end-to-end:
>
> 1. Start the backend (`npm run dev`) and frontend (`npm run fe:dev`) so the UI is reachable.
> 2. Visit http://localhost:3000/health to confirm the API is live, then go to /ui/login and mint the admin cookie if needed.
> 3. In /ui/builder, create a template (add an input_text field and enable a deployment channel) and click “Run Template”.
> 4. Navigate to /ui/responses, open the run you just created, inspect the buffered assistant output, the raw `response.completed` event, and metadata.
> 5. Click “Retry Run” and verify a second run with `retried_from` metadata appears.
> 6. Toggle `RESPONSES_ARCHIVE_TTL_DAYS=1`, restart the API, refresh /ui/responses, and confirm older runs drop off; if necessary, edit a JSON file under `local_data/responses/` to simulate age.
> 7. Hit `POST /responses/ops/prune` with `{ "days": 1 }` and verify stale runs disappear while recent ones remain.
>
> Document every click, page load, and observation, including any UI defects or known issues you encounter. Do not mark the walkthrough complete until each numbered step above has been performed in the browser.

## Environment Preparation
1. Install Node.js 20 and PostgreSQL (or rely on the file-system store for quick checks).
2. Copy `.env.example` to `.env` and populate `OPENAI_API_KEY`. Set `RESPONSES_RUNTIME_MODE=stub` for offline smoke tests; switch to real keys for end-to-end validation.
3. Run `npm install` to install dependencies.
4. Start backing services with `./Start DB + NOFX.command` (fires up Supabase, Redis, and background workers).
5. Launch the stack with `npm run dev` (API + worker) and, optionally, `npm run fe:dev` for the Vite frontend.

## Sanity Checks
1. Hit `http://localhost:3000/health` and confirm `{ ok: true }`.
2. Visit `http://localhost:3000/ui/runs` and verify the runs table renders.
3. Log in as an admin via `/ui/login` (cookie helper in tests or real auth in prod environments).

## Builder → Responses Workflow
1. Navigate to `/ui/builder`.
2. Create a new template using the inline form; set at least one `input_text` field and enable a deployment channel.
3. Click **Run Template**. In stub mode, expect redirected run output with canned assistant text; with live keys, expect real Responses output.
4. Confirm `/ui/responses` now lists the new run with a recent timestamp.
5. Open the run detail page and verify:
   - Assistant output shows buffered text.
   - Raw events include `response.created` and `response.completed`.
   - Metadata includes `tenant_id` and template identifiers.
6. Press **Retry Run** and ensure a new run appears with `retried_from` metadata pointing to the original.

## Operational Dashboards
1. On `/ui/responses`, confirm the summary metrics (total runs, failures in the last 24h, average tokens).
2. Toggle `RESPONSES_ARCHIVE_TTL_DAYS=1`, restart the API, and verify runs older than one day disappear after a refresh.
3. Call `POST /responses/ops/prune` with `{ "days": 0.1 }` (via `curl` or Postman) and confirm old runs purge while newer ones remain.
4. Check the console logs for rate-limit snapshots when using real API keys (`x-ratelimit-*` values).

## Documentation Archive Integrity
1. For a run with streaming events, stream `/runs/:id/stream` and ensure SSE batches arrive in order.
2. Use `/runs/:id/timeline` to confirm persisted events match those shown in the UI.
3. Validate rollback: replay a run using the archive and ensure reconstructed state matches the original assistant output.

## Gate and Policy Enforcement
1. Create a plan that includes a manual gate (`gate:manual`) and confirm `/ui/runs/:id` displays pending approval.
2. Approve and waive the gate to ensure events and badges update correctly.
3. Trigger a policy violation (tool not in allowlist) and confirm the run fails with `policy.denied` in the timeline.

## Regression Suite (Automated)
1. Run `npm run lint` and `npm run typecheck` for static analysis.
2. Execute `npx jest` (set `RESPONSES_RUNTIME_MODE=stub` to avoid network calls).
3. For a full gate, run `npm run gates` (includes SAST, secrets scan, unused code check).

## Production Readiness Checklist
- [ ] Backups: Confirm autobackup settings in `/ui/settings` and that `src/lib/autobackup.ts` writes snapshots.
- [ ] Observability: Verify logs reach the configured sink and that rate-limit telemetry appears in dashboards.
- [ ] Security: Run `npm run test:security` if available and ensure admin routes require authenticated cookies.
- [ ] Documentation: Update release notes with any template or ops workflow changes.
