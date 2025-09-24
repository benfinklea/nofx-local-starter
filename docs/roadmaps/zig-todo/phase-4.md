# 🤖 Zig Todo · Phase 4 — Planner Console & Approval Workflow

> Goal: operate the auto planner, review gate verdicts, and handle human tool approvals.

---

## Track A — Planner Control Room
- Trigger plan/execute actions; visualise plan graphs with gate status and model comparison results.
- Feature flag toggles with audit trail (FEATURE_AUTO_PLANNER, etc.).

## Track B — Human Tool Approvals
- Approval inbox showing pending requireApproval requests with comment box and history.
- CLI zig approvals list|approve|deny for headless workflows.

## Track C — Audit & Notifications
- Record who approved/overrode actions; push notifications for urgent approvals.
- SSE updates (plan.ready, plan.blocked, plan.approved).

---

## Exit Checklist
- [ ] Planner console renders plans and gate outcomes.
- [ ] Approval UX/CLI allow decisions with comments and logging.
- [ ] Notifications keep supervisors responsive.

## Solo Workflow & Tests
1. Build planner console, then run: npm run test -- --runInBand tests/ui/plannerConsole.test.ts.
2. Implement approval inbox/CLI, then run: npm run test -- --runInBand tests/ui/approvalInbox.test.ts.
3. Wire notifications/audit, then run: npm run lint, npm run typecheck, npm run test -- --runInBand.

Move forward once the checklist is complete.
