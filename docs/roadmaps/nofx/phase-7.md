# 🏛️ NOFX Control Plane · Phase 7 — Governance, Compliance & NL Ops

> Goal: put enterprise guardrails on routing, deliver compliance tooling, and surface operations through NL dashboards, exports, and batch controls.

---

## Track A — Router Governance
- Implement RouterProxy abstraction for native/external routers with health checks and auto-rollback.
- Governance table capturing approvals, change reasons, rollback timers.
- Dual-approval workflow exposed via API/CLI; publish router.mode_changed events.

## Track B — Compliance & Access
- Integrate SSO/SAML/OIDC hooks with RBAC.
- Enforce data residency by mapping projects to storage regions/buckets.
- Secrets rotation service with audit logging and zero-downtime reload.
- Billing hooks exporting usage (tokens, compute, storage) for invoicing.
- Tamper-evident audit log for sensitive operations.

## Track C — NL Ops & Analytics
- NL query endpoint (POST /ops/query) translating safe prompts into metrics queries with audit logging.
- Health dashboard summarising queue/circuit breaker status, DLQ, quotas, environment configs.
- Advanced analytics (cost, SLA, branching history, remediation outcomes) with export to PDF/CSV.
- Export/import toolkit for run backups with integrity checks.

## Track D — Batch & Chaos Controls
- UI/CLI for bulk cancel/retry with safeguards and rate limits.
- Expand chaos suite (network partitions, region outage) and document recovery runbooks.
- Periodic idempotency audits with fallback deduplication.

---

## Deliverables
- Router governance with approvals, rollback, and observability.
- Compliance features covering SSO, residency, secrets, billing, and audit trails.
- NL ops console + exports providing leadership visibility.
- Batch tooling and chaos tests completing the autonomy readiness cycle.

## Exit Checklist
- [ ] Router proxy governed, monitored, and reversible.
- [ ] Compliance stack (SSO, residency, secrets rotation, billing exports) live.
- [ ] NL ops and analytics dashboards plus export/import workflows operational.
- [ ] Batch/chaos operations manageable with documented runbooks.

## Solo Workflow & Tests
1. **Track A** – router governance. Run: npm run test -- --runInBand tests/integration/routerGovernance.test.ts.
2. **Track B** – compliance stack. Run: npm run test -- --runInBand tests/unit/compliance.test.ts and manual secret rotation smoke test.
3. **Track C** – NL ops & analytics. Run: npm run test -- --runInBand tests/unit/nlOps.test.ts, then npm run gates.
4. **Track D** – batch/chaos controls. Run: npm run test -- --runInBand tests/integration/batchOps.test.ts and execute chaos suite script.

Check the exit list once all tracks, automated tests, and manual chaos drills succeed.
