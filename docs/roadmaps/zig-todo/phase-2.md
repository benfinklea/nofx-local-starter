# 🛡️ Zig Todo · Phase 2 — Safety Dashboard & Handler Toolkit

> Goal: visualise NOFX’s new safety features, guide handler authors, and surface hook/event metrics.

---

## Track A — Safety Dashboard
- Display /health and /metrics counters (queue depth, DLQ, circuit breaker status, sandbox usage, hook executions).
- Alert when limits exceed thresholds; link to runbooks.

## Track B — Handler Toolkit
- CLI zig handlers new|test scaffolding TypeScript handlers with resource profiles and local sandbox harness.
- UI page listing handlers with runtime/error metrics and sandbox driver info.

## Track C — Bootstrap Helpers
- Surface scripts/bootstrap-dev.sh output in the UI; warn if dependencies missing.
- Provide onboarding checklist for new contributors.

---

## Exit Checklist
- [ ] Safety dashboard live with alerts and documentation.
- [ ] Handler scaffolder/testing harness available via UI/CLI.
- [ ] Onboarding checklist integrated into docs.

## Solo Workflow & Tests
1. Build the dashboard, then run: npm run test -- --runInBand tests/ui/safetyDashboard.test.ts.
2. Implement handler toolkit, then run: npm run test -- --runInBand tests/cli/handlerToolkit.test.ts.
3. Add bootstrap helpers, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Advance once the exit checklist items are complete.
