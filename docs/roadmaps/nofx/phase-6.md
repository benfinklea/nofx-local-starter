# 🐝 NOFX Control Plane · Phase 6 — Hierarchical & Hive-Mind Orchestration

> Goal: coordinate multi-role agents (hierarchical + swarm), add deep research tooling, and kick off auto-remediation.

---

## Track A — Strategy Selection
- Extend dispatcher to choose solo, pair, hierarchical, or hive-mind swarm strategies based on metadata and performance metrics.
- Persist relationships in run_agent_hierarchy (parent, child, role, metrics) and enforce quotas/circuit breaker data.

## Track B — Messaging & Approvals
- Build durable messaging bus for agent summaries and escalation requests.
- Enhance conversation logs with hierarchy markers, redaction support, retention windows.

## Track C — Deep Research Handler
- Implement research:investigate orchestrating search → summarize → synthesize with fallbacks when providers fail.
- Checkpoint before/after research steps to capture findings.

## Track D — Auto-Remediation Rules
- Create remediation_rules matching failure signatures to follow-up plans or automation steps.
- Allow automatic execution with supervisor approval by default; measure success rate and overrides.

---

## Deliverables
- Dispatcher supports hierarchical + swarm orchestration with clear metrics.
- Messaging/approval flow keeps supervisors in the loop.
- Research handler and remediation rules accelerate recovery from failures.

## Exit Checklist
- [ ] Hierarchy and swarm strategies active with tracking + quotas.
- [ ] Messaging bus supports approvals/escalations.
- [ ] Research handler shipping artifacts and honouring checkpoints.
- [ ] Remediation rules triggering follow-up plans with measurable success rate.

## Solo Workflow & Tests
1. **Track A** – update dispatcher + hierarchy tables. Run: npm run test -- --runInBand tests/integration/hierarchyDispatch.test.ts.
2. **Track B** – messaging/approval bus. Run: npm run test -- --runInBand tests/unit/hierarchyMessaging.test.ts.
3. **Track C** – deep research handler. Run: npm run test -- --runInBand tests/integration/researchHandler.test.ts.
4. **Track D** – remediation rules. Run: npm run test -- --runInBand tests/unit/remediationRules.test.ts, then npm run gates.

Sign off the exit checklist after all tests pass and manual research/remediation smoke tests look good.
