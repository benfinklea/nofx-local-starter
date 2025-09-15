Workstream 01 — Reliability & Delivery Guarantees

Objective
Idempotent, exactly-once step execution with retries and dead-letter queues.

Steps
1) Schema
   - Add columns: `nofx.step.idempotency_key text unique`, `nofx.event.idempotency_key text`.
   - Add tables: `nofx.outbox`, `nofx.inbox` with unique keys.
2) API enqueue
   - Generate idempotency keys per step: `${runId}:${stepName}:${hash(inputs)}`.
   - Upsert step with key; skip enqueue if exists and in-progress.
3) Worker subscribe
   - Check `inbox` by key; if seen, ack and return.
   - Process with timeout; on success/failure, record event with outbox write.
4) Relay
   - Small daemon that reads `outbox` and publishes to queue; marks sent.
5) Queue policies
   - Configure retries/backoff (2, 5, 10s) and DLQ topic; add `/dev/dlq` list/rehydrate endpoints.

Validation
- Contract tests (Vitest): idempotent enqueue/execute; duplicate deliveries ignored; DLQ moves after max retries.

