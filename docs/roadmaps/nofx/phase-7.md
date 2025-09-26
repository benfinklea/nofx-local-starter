# 🏛️ NOFX Control Plane · Phase 7 — Cloud Governance, Compliance & NL Ops

> Goal: deliver enterprise guardrails, compliance tooling, and natural-language operations dashboards purpose-built for the Supabase + Vercel cloud stack.

---

## Track A — Router Governance
- Implement `RouterProxy` abstraction for native/external routers with health checks, latency budgets, and auto-rollback using Supabase `router_states`.
- Governance workflow stored in `router_governance` table capturing approvals, change reasons, rollback timers, and multi-region deployment status.
- Dual-approval API/CLI exposed via Vercel Functions; publish `router.mode_changed` events to Supabase realtime + Slack.

## Track B — Compliance & Access
- Integrate SSO/SAML/OIDC with Supabase Auth and map roles to RBAC policies consumed by Vercel Functions and worker.
- Enforce data residency by mapping projects to Supabase storage regions/buckets; replicate secrets using HashiCorp Vault + Supabase integration.
- Secrets rotation service with audit logging and zero-downtime reload delivered via Vercel cron jobs.
- Billing exports aggregate usage (tokens, compute, storage) from Supabase tables into BigQuery/Snowflake connectors.
- Tamper-evident audit log using cryptographic chaining stored in Supabase `audit_log_chain`.

## Track C — NL Ops & Analytics
- NL query endpoint `POST /api/ops/query` translating safe prompts into SQL against Supabase analytics schema with audit logging + rate limits.
- Cloud health dashboard summarizing queue/circuit breaker status, DLQ, quotas, environment configs, and spend using Supabase materialized views.
- Advanced analytics (cost, SLA, branching history, remediation outcomes) exported to PDF/CSV via Vercel background jobs.
- Export/import toolkit for run backups with integrity checks stored in Supabase storage + hashed manifest.

## Track D — Batch & Chaos Controls
- UI/CLI for bulk cancel/retry with guardrails, region scoping, and Supabase transactions ensuring idempotency.
- Expand chaos suite simulating Supabase outages, Vercel region failovers, and external provider throttling; document recovery runbooks.
- Periodic idempotency audits with fallback deduplication scripts that run via Vercel cron + worker jobs.

---

## Deliverables
- Router governance with Supabase-backed approvals, rollback, and observability across regions.
- Compliance stack covering identity, residency, secrets rotation, billing exports, and tamper-evident audit logging.
- NL ops console with analytics dashboards and export tooling for leadership visibility.
- Batch operations and chaos testing frameworks validating cloud resiliency.

## Exit Checklist
- [ ] Router proxy governed, monitored, and reversible with Supabase governance tables and alerts.
- [ ] Compliance stack (SSO, residency, secrets rotation, billing exports) live with tamper-evident logs.
- [ ] NL ops and analytics dashboards plus export/import workflows operational in cloud environments.
- [ ] Batch/chaos operations manageable with documented cloud recovery runbooks.

## Solo Workflow & Tests
1. **Track A** – router governance. Run: `npm run test -- --runInBand tests/integration/routerGovernance.cloud.test.ts`.
2. **Track B** – compliance stack. Run: `npm run test -- --runInBand tests/unit/compliance.cloud.test.ts` and manual secret rotation smoke test.
3. **Track C** – NL ops & analytics. Run: `npm run test -- --runInBand tests/unit/nlOps.cloud.test.ts`, then `npm run gates`.
4. **Track D** – batch/chaos controls. Run: `npm run test -- --runInBand tests/integration/batchOps.cloud.test.ts` and execute chaos suite script targeting Vercel + Supabase.

Check the exit list once all tracks, automated tests, and manual chaos drills succeed across the cloud stack.
