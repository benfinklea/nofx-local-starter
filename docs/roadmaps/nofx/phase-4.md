# 🤖 NOFX Control Plane · Phase 4 — Auto Planner & Human Gating

> Goal: generate executable plans from the backlog, compare models, and require approvals for sensitive steps.

---

## Track A — Planner Core
- Implement src/services/autoPlanner to group backlog items, respect dependencies, and build plan graphs with idempotency tokens + rollback instructions.
- Gate rollout behind FEATURE_AUTO_PLANNER and FEATURE_PLANNER_EXECUTE flags.
- Optional multi-model comparison: route prompts to multiple providers, score results, store in model_comparisons.

## Track B — Gate Evaluators
- Structural, risk, compliance, and resource gate handlers returning allow/warn/block with remediation tips.
- Persist results in plan_evaluations and emit events for clients.
- Include resource cost estimates using Phase 2 metrics.

## Track C — Human Tool Approvals
- HumanLayer-style requireApproval(toolId) helper pausing execution for review with comments.
- Approval log table capturing approver, decision, notes, timestamps.
- Webhook/API for Zig Todo to approve/deny and resume.

## Track D — Planner APIs & Audit
- Endpoints: POST /auto-planner/plan, POST /auto-planner/execute, POST /automation/override.
- Audit records linking approvals, overrides, and plans back to backlog items and packs.
- Events: plan.ready, plan.blocked, plan.approved.

---

## Deliverables
- Auto planner capable of producing executable plans with gate verdicts.
- Multi-model comparison data feeding planner metrics.
- Human-in-the-loop gating for sensitive tools, fully audited.

## Exit Checklist
- [ ] Auto planner generates plans and records gate verdicts per step/model.
- [ ] Human approval workflow operational with logs and UI/API tie-ins.
- [ ] Overrides and approvals audited; events flow to clients.
- [ ] Feature flags allow planner/execute paths to roll out independently.

## Solo Workflow & Tests
1. **Track A** – build planner core. Run: npm run test -- --runInBand tests/integration/autoPlanner.test.ts.
2. **Track B** – add gate evaluators. Run: npm run test -- --runInBand tests/unit/gateHandlers.test.ts.
3. **Track C** – implement human approvals. Run: npm run test -- --runInBand tests/integration/humanApproval.test.ts.
4. **Track D** – expose APIs/audit. Run: npm run lint, npm run gates.

Check the exit list once all four tracks and tests pass.
