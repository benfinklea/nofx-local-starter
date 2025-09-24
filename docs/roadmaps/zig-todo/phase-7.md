# 🏛️ Zig Todo · Phase 7 — Governance & Compliance Hub

> Goal: expose router approvals, compliance settings, NL ops console, and batch tools that land in NOFX Phase 7.

---

## Track A — Router Governance UI
- Show routing mode, provider health, change history.
- Dual-approval workflow for mode/profile changes with diff preview and rollback.
- CLI parity via zig router status|change|rollback.

## Track B — Compliance Console
- Configure SSO/IdP settings, project roles, data residency targets.
- Trigger secrets rotation and view billing/usage exports.

## Track C — NL Ops & Analytics
- NL query console using NOFX /ops/query with saved queries and audit log.
- Advanced dashboards for cost, SLA, branching, remediation outcomes; exportable reports.

## Track D — Batch & Chaos Controls
- UI/CLI for bulk cancel/retry with safeguards.
- Display chaos test status and link to recovery runbooks.

---

## Exit Checklist
- [ ] Router governance with approvals + rollback available in UI/CLI.
- [ ] Compliance features surfaced for admins (SSO, residency, secrets, billing).
- [ ] NL ops console delivers shareable insights.
- [ ] Batch/chaos operations manageable from Zig Todo.

## Solo Workflow & Tests
1. Build router governance UI/CLI, then run: npm run test -- --runInBand tests/ui/routerGovernance.test.ts.
2. Implement compliance console, then run: npm run test -- --runInBand tests/ui/complianceConsole.test.ts.
3. Create NL ops analytics, then run: npm run test -- --runInBand tests/ui/nlOpsConsole.test.ts.
4. Add batch/chaos controls, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Complete the exit checklist after all steps pass and governance workflows are verified end-to-end.
