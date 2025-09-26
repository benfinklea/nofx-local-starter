# 📡 NOFX Control Plane · Phase 5 — Cloud Observability & Review Center

> Goal: make every run traceable across Supabase, Vercel, and worker containers while supporting resumable context and cloud-native AI review gates.

---

## Track A — State Machine & Cloud Checkpoints
- Formalise run/step state transitions in Supabase with constraints + check functions consumed by worker and API.
- Capture checkpoints pre/post major steps and on gate failures; store artifacts in Supabase storage with signed URLs.
- Provide branch/merge APIs to resume work from checkpoints, ensuring idempotency for Vercel invocations.

## Track B — Session Memory Persistence
- Durable storage for conversation history, workspace snapshots, and preferences using Supabase `session_memory` with encryption-at-rest + TTL policies.
- APIs for supervisors to inspect/redact context; send alerts via Supabase functions before TTL expiry.

## Track C — Diff & RCA Utilities
- Endpoint `GET /api/runs/:id/checkpoints/:checkpointId/diff` returning structured diffs stored in Supabase storage.
- RCA bundles aggregating logs, metrics, checkpoints, gate verdicts, resource usage; downloadable through signed URLs.
- CLI helper `npm run rca:download -- --run=<id>` hitting cloud endpoints.

## Track D — Metrics, Tracing & SSE
- Extend Prometheus exposure with queue latency histograms, handler CPU/memory, approval counts, sandbox usage; forward to Grafana Cloud.
- Provide typed SSE stream via Vercel Edge Functions that replays Supabase realtime events with filtering + pagination.
- Add distributed tracing (OpenTelemetry) from Vercel Functions to worker container with Supabase trace IDs.

## Track E — AI Review Gate
- Implement `gate:llm_review` using MCP GitHub/Bitbucket connectors to post line-level comments from the cloud worker.
- Provide sample workflow `.github/workflows/nofx-llm-review.yml` using Supabase secrets + Vercel Deploy Hooks for staging reviews.
- Store review artifacts in Supabase `review_artifacts` and allow rerun/resolution tracking through frontend dashboards.

---

## Deliverables
- State machine + checkpoints + session memory anchored in Supabase for resumable automation.
- Observability endpoints and typed SSE streams spanning Vercel and worker traces.
- AI review gate integrated with cloud CI/CD and stored artifacts for audits.

## Exit Checklist
- [ ] State machine enforced in Supabase; checkpoints/branching/diff working end to end with signed URLs.
- [ ] Session memory persists with encryption + TTL alerts and supervisor tooling.
- [ ] Metrics/SSE expose typed events and feed Grafana/Prometheus alongside OpenTelemetry traces.
- [ ] LLM review gate documented with a working GitHub workflow hitting cloud infrastructure.

## Solo Workflow & Tests
1. **Track A** – state machine + checkpoints. Run: `npm run test -- --runInBand tests/integration/checkpoints.cloud.test.ts`.
2. **Track B** – session memory store. Run: `npm run test -- --runInBand tests/unit/sessionMemory.cloud.test.ts`.
3. **Track C** – diff/RCA utilities. Run: `npm run test -- --runInBand tests/unit/rcaBundles.cloud.test.ts`.
4. **Track D** – metrics/SSE. Run: `npm run test -- --runInBand tests/unit/eventStream.cloud.test.ts`, then `npm run gates`.
5. **Track E** – LLM review gate. Run: `npm run test -- --runInBand tests/integration/llmReviewGate.cloud.test.ts` and execute GitHub workflow in dry-run mode.

Complete the exit checklist once every track and test passes against Supabase + Vercel infrastructure.
