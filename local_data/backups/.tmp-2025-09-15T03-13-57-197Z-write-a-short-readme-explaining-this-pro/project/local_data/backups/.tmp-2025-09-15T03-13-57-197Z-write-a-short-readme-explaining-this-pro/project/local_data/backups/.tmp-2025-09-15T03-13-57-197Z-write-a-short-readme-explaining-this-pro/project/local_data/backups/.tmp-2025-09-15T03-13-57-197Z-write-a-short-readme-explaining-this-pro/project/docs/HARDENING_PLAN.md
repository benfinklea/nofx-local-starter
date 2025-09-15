Title: NOFX Control Plane Hardening — Enterprise Track

Goal
Make the control plane rock‑solid: deterministic, durable, observable, and safe. This plan is modular and parallelizable.

Milestone A — Reliability & Delivery Guarantees
1) Idempotency keys for steps and events
   - Add `idempotency_key` to `nofx.step` and outbox/inbox tables.
   - Enqueue/execute with upserts by key; ignore duplicates.
2) Outbox pattern + DLQ
   - Persist events in the same TX; relay publishes to queue.
   - Configure retries/backoff and a per-topic dead-letter queue.
3) Timeouts per tool
   - Enforce max wall time and cancel; record `step.timeout` event.

Milestone B — Deterministic Graphs & Resume
1) Persist DAG
   - Steps include `depends_on` edges and `ready_at` schedule.
2) Resume from checkpoints
   - UI/API: re-run failed step; cascade to dependents.

Milestone C — Observability
1) Structured logs with context (runId/stepId)
2) Trace spans for API/worker/queue (OpenTelemetry)
3) Metrics (Prometheus): queue depth, job latency, success rate, retries, DLQ size
4) Dashboards + alerts on SLOs

Milestone D — Policy & Safety
1) Tool allowlists + secret scopes per step
2) Manual gate by default for `git_pr`; dry‑run/preview mode
3) Security gates (SAST/dep audit) as built‑ins

Milestone E — Data & Lineage
1) Artifact hashes and provenance (tool, inputs hash)
2) Inputs/outputs hashing for cacheability and replay
3) Snapshot/restore (implemented) + production DB backups

Milestone F — Performance & Cost
1) Parallelize based on DAG
2) Backpressure & concurrency controls per worker
3) Cost budgets per run and provider; cost‑aware model routing

Cutover sequence (safe)
- Stage with feature flags per milestone.
- Start with A (delivery guarantees), then C (observability), then D (policy).

