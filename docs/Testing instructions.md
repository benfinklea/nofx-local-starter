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
4. Start backing services with `./Start DB + NOFX.command`. The script now auto-installs the Supabase CLI via `npx` when it isn’t present, exports `QUEUE_DRIVER=memory`/`REDIS_URL=memory`, boots the Supabase Postgres stack, and launches the API, worker, and Vite frontend.
5. If you prefer to start pieces manually, run `npm run dev` (API + worker) and `VITE_HOST=0.0.0.0 VITE_PORT=5173 npm run fe:dev` so the frontend binds to `0.0.0.0` for remote/browser access.

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
   - Assistant output shows buffered text stitched from the streaming deltas.
   - Raw events include `response.created`, `response.output_text.*`, and `response.completed`.
   - Metadata includes `tenant_id`, template identifiers, and rate-limit snapshots in the sidebar.
   - The **Delegations** panel lists every tool hand-off (function call name, status, completion time, output snippet).
   - If the run used audio, expand **Audio Output** and confirm both the waveform (base64) and transcript appear; otherwise, trigger a speech template and repeat.
   - If the run used image generation, confirm the preview renders and the metadata (size, background) matches the archive record.
   - The **Input Transcripts** table captures any user speech you provided during the run.
6. Scroll to the **Incidents** card. If the run failed, confirm a linked incident entry appears; on a successful retry, ensure the incident shows as resolved with the new run id.
7. Press **Retry Run** and ensure a new run appears with `retried_from` metadata pointing to the original and an automatic incident resolution entry.

## Operational Dashboards
1. On `/ui/responses`, confirm the summary metrics (total runs, failures in the last 24h, average tokens, refusal totals, open incidents).
2. Click **View Ops Summary** and verify the tenant rollups include run counts, total tokens, refusal counts, latest run timestamps, and rate-limit snapshots (remaining request/token percentages).
3. Verify the audio/image/delegation charts surface accurate counts and success rates that match the archived events you inspected above.
4. Confirm the **Total Estimated Cost** metric and the tenant table’s new “Estimated Cost / Regions” columns populate using the latest archive metadata (with real runs, ensure the figures line up with the request usage and tenant region config).
5. Toggle `RESPONSES_ARCHIVE_TTL_DAYS=1`, restart the API, and verify runs older than one day disappear after a refresh.
6. Call `POST /responses/ops/prune` with `{ "days": 0.1 }` (via `curl` or Postman) and confirm old runs purge while newer ones remain.
7. Check the console logs for rate-limit snapshots when using real API keys (`x-ratelimit-*` values) and ensure the UI reflects the latest snapshot.

## Multimodal & Delegation Validation
1. Run a speech-enabled template (or manually stream audio via the dev console) and confirm:
   - `/ui/responses/:id` displays buffered audio chunks and the synthesized transcript under **Audio Output**.
   - The archive timeline includes `response.output_audio.*` and `conversation.item.input_audio_transcription.*` events in order.
2. Execute an image generation template and verify the run detail page renders the final image with correct metadata, while the archive export contains the same base64 or URL reference.
3. Trigger a workflow that calls external tools (MCP or function calls). Inspect the **Delegations** panel to ensure each call records `requested`, `completed/failed`, arguments, outputs, and any linked run ids. Confirm the archive JSON shows matching records.
4. For a failing delegation, ensure an incident is created and that resolving the incident (either manually through `/responses/ops/incidents` or by retrying the run) updates the incident status.
5. Export the run via the **Export** button and double-check the `.json.gz` bundle contains audio, image, transcript, and delegation metadata while redacting hashed safety identifiers; confirm lineage/session IDs are present for governance review.
6. Record pass/fail for each scenario—this suite feeds the Phase 5 release gate and must be rerun ahead of every rollout.

## Documentation Archive Integrity
1. For a run with streaming events, stream `/runs/:id/stream` and ensure SSE batches arrive in order.
2. Use `/runs/:id/timeline` to confirm persisted events match those shown in the UI.
3. Validate rollback:
   - Invoke `POST /responses/runs/:id/rollback` with a `sequence` or `toolCallId` payload and confirm the response reflects a truncated timeline.
   - Refresh `/ui/responses/:id` and ensure the assistant output/metrics align with the rolled-back state.
   - Confirm the run metadata now includes `last_rollback_*` fields in the archive JSON export.
4. Replay the run using the archive and ensure reconstructed state matches the original assistant output after rollback.

## Gate and Policy Enforcement
1. Create a plan that includes a manual gate (`gate:manual`) and confirm `/ui/runs/:id` displays pending approval.
2. Approve and waive the gate to ensure events and badges update correctly.
3. Trigger a policy violation (tool not in allowlist) and confirm the run fails with `policy.denied` in the timeline.

## Regression Suite (Automated)
1. Run `npm run lint` and `npm run typecheck` for static analysis.
2. Execute `npx jest` (set `RESPONSES_RUNTIME_MODE=stub` to avoid network calls).
3. Run `npm run test:load` (load/performance guard) and investigate any failures before proceeding.
4. For a full gate, run `npm run gates` (includes SAST, secrets scan, unused code check). Note that `npm run lint` now emits stylish text output rather than raw JSON; gate artifacts capture the human-readable log.

## Production Readiness Checklist
- [ ] Backups: Confirm autobackup settings in `/ui/settings` and that `src/lib/autobackup.ts` writes snapshots.
- [ ] Observability: Verify logs reach the configured sink and that rate-limit telemetry appears in dashboards.
- [ ] Security: Run `npm run test:security` if available and ensure admin routes require authenticated cookies.
- [ ] Documentation: Update release notes with any template or ops workflow changes.
