# 🔐 NOFX Control Plane · Phase 2 — Cloud Safety & Sandbox Foundations

> Goal: harden the cloud runtime so every Vercel invocation and worker container step is observable, rate limited, recoverable, and sandboxed when needed across multiple regions.

---

## Track A — Distributed Event Bus & Hooks
- Build `src/lib/eventBus.ts` backed by Supabase realtime channels + Redis-compatible fallback for local dev.
- Refactor `src/lib/events.ts` and `src/worker/runner.ts` to emit step lifecycle events through the bus with tenant + region metadata.
- Add hook manager that runs inside Vercel Functions (pre/post/error) and worker container (background hooks) with idempotency tokens.
- Export Prometheus-compatible metrics via worker `/metrics` and expose lightweight metrics snapshot from Vercel Edge Config (`/api/metrics/summary`).

## Track B — Runtime Guardrails
- Enforce `NON_INTERACTIVE_MODE` defaults in production deployments; disable chokidar/watchers in cloud runtimes.
- Secure admin routes with `INTERNAL_API_KEY` + Supabase RLS, attach correlation IDs sourced from Vercel request IDs.
- Add API Gateway rate limiting using Upstash or Supabase functions; enforce body-size + schema checks on `/api/runs`.
- Audit trail writes to Supabase `audit_log` with encrypted payloads for sensitive rows.

## Track C — Failure Containment
- Create per-handler circuit breakers stored in Supabase `handler_health` and consumed by both worker and API (shared cache via Edge Config).
- Add retry backoff, `step_dlq` tables, and action CLI `/commands/dlq:inspect` to requeue jobs.
- Monitor queue depth with Supabase cron tasks that publish alerts to Slack/Webhook when latency crosses thresholds.

## Track D — Execution Drivers & Sandboxes
- Define execution drivers (vercel-function | worker-container | modal | e2b) configurable per step with Supabase-managed secrets.
- Containerized driver tracks lifecycle, resource caps, cleanup cron, and publishes metrics.
- Heavy bash/tooling handlers respect driver selection; worker enforces resource quotas from Supabase config.

## Track E — Zero-Config Cloud Bootstrap
- `scripts/bootstrap-dev.sh` provisions `.env`, registers default MCP servers, checks Supabase connectivity, seeds preview schema.
- Document onboarding in `README_LOCAL` + `AI_CODER_GUIDE` highlighting how to request temp Supabase keys.
- Add smoke test workflow `npm run smoke:cloud` hitting production endpoints with read-only checks.

---

## Deliverables
- Cloud-aware event bus and hook pipeline spanning Vercel Functions and worker containers.
- Guardrails for authentication, rate limiting, and audit logging that assume internet-facing APIs.
- Failure containment via circuit breakers, DLQs, and queue monitoring stored in Supabase.
- Execution drivers and bootstrap tooling tuned for cloud deployments.

## Exit Checklist
- [ ] Event bus + hooks emit structured events with region + tenant metadata and surface metrics.
- [ ] Rate limits, audit logging, and DLQ/circuit breaker flows active in production Supabase + Vercel.
- [ ] Execution drivers isolated with cleanup + monitoring; heavy handlers honour driver choice.
- [ ] Bootstrap scripts/docs verified on fresh cloud-linked environment.

## Solo Workflow & Tests
1. **Track A** – implement event bus/hooks. Run: `npm run lint`, `npm run typecheck`, `npm run test -- --runInBand tests/unit/eventBus.cloud.test.ts`.
2. **Track B** – add guardrails. Run: `npm run test -- --runInBand tests/integration/cloudGuardrails.test.ts`.
3. **Track C** – add DLQ/circuit breaker. Run: `npm run test -- --runInBand tests/unit/dlq.cloud.test.ts`, then `npm run gates`.
4. **Track D** – wire execution drivers. After manual sandbox smoke test, run: `npm run test -- --runInBand tests/integration/executionDrivers.cloud.test.ts`.
5. **Track E** – finish bootstrap docs/script. Final sweep: `npm run smoke:cloud` followed by `npm run lint` and `npm run typecheck`.

Check the exit list only when all steps pass against Supabase + Vercel environments.
