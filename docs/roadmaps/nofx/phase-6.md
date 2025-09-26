# 🐝 NOFX Control Plane · Phase 6 — Cloud Hierarchy & Hive-Mind Orchestration

> Goal: coordinate multi-role agents (hierarchical + swarm) with Supabase-backed orchestration, deep research tooling, and cloud auto-remediation.

---

## Track A — Strategy Selection & Metrics
- Extend dispatcher to choose solo, pair, hierarchical, or swarm strategies based on Supabase telemetry (success rate, latency, cost) and backlog metadata.
- Persist relationships in `run_agent_hierarchy` table (parent, child, role, metrics, cloud region) with quotas + circuit breaker counters shared via Edge Config.
- Build dashboards in frontend using Supabase realtime to visualize hierarchy health.

## Track B — Messaging & Approvals
- Implement durable messaging bus for agent summaries and escalation requests using Supabase `agent_messages` with retention windows and redaction support.
- Enhance conversation logs with hierarchy markers exposed through `/api/runs/:id/messages` served by Vercel Functions.
- Integrate supervisor approvals into the same Supabase `approvals` table introduced in Phase 4 with hierarchy context.

## Track C — Deep Research Handler
- Implement `research:investigate` orchestrating search → summarise → synthesise with fallback providers; track provider usage in Supabase `research_runs`.
- Store research artifacts (source captures, extracts) in Supabase storage; generate digest for audit logs.
- Checkpoint before/after research steps to capture findings for replays.

## Track D — Auto-Remediation Rules
- Create `remediation_rules` mapping failure signatures (from Supabase observability tables) to follow-up plans or automation steps.
- Allow automatic execution with supervisor approval defaults; capture metrics on success rate, overrides, time-to-recovery.
- Surface remediation suggestions via `/api/remediation/:runId` and dashboard modules.

---

## Deliverables
- Dispatcher supports hierarchical + swarm orchestration with Supabase metrics and quotas.
- Messaging/approval flow keeps supervisors in the loop using cloud messaging tables.
- Research handler and remediation rules accelerate recovery from failures across cloud deployments.

## Exit Checklist
- [ ] Hierarchy and swarm strategies active with Supabase tracking + quotas enforced via Edge Config.
- [ ] Messaging bus supports approvals/escalations with retention and redaction controls.
- [ ] Research handler ships artifacts and checkpoints to Supabase storage for audits.
- [ ] Remediation rules triggering follow-up plans with measurable success rate in dashboards.

## Solo Workflow & Tests
1. **Track A** – update dispatcher + hierarchy tables. Run: `npm run test -- --runInBand tests/integration/hierarchyDispatch.cloud.test.ts`.
2. **Track B** – messaging/approval bus. Run: `npm run test -- --runInBand tests/unit/hierarchyMessaging.cloud.test.ts`.
3. **Track C** – deep research handler. Run: `npm run test -- --runInBand tests/integration/researchHandler.cloud.test.ts`.
4. **Track D** – remediation rules. Run: `npm run test -- --runInBand tests/unit/remediationRules.cloud.test.ts`, then `npm run gates`.

Sign off the exit checklist after automated tests and manual research/remediation smoke tests succeed against cloud resources.
