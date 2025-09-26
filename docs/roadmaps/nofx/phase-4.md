# 🤖 NOFX Control Plane · Phase 4 — Auto Planner & Cloud Gating

> Goal: generate executable plans from the backlog, compare models, and require approvals for sensitive steps with Supabase-backed auditability across cloud services.

---

## Track A — Planner Core
- Implement `src/services/autoPlanner` to group backlog items, respect dependencies, and build plan graphs with idempotency tokens stored in Supabase `plans` + `plan_steps` tables.
- Gate rollout behind `FEATURE_AUTO_PLANNER` and `FEATURE_PLANNER_EXECUTE` flags managed via Supabase config table editable through Vercel admin UI.
- Optional multi-model comparison: route prompts to multiple providers, store outcomes in `model_comparisons` table with latency/cost metrics for cloud cost accounting.

## Track B — Gate Evaluators
- Structural, risk, compliance, and resource gate handlers returning allow/warn/block with remediation tips; results persisted in Supabase `plan_evaluations` with JSON schema.
- Include resource cost estimates using Phase 2 metrics + Supabase usage data; expose aggregated scores in `/api/gates/:planId`.
- Publish gate events via Supabase realtime for dashboards and Slack notifications.

## Track C — Human Tool Approvals
- Implement `requireApproval(toolId)` using Supabase `approvals` table with row-level locks to pause execution.
- Store approval history (approver, decision, reason, timestamps); integrate with Vercel `POST /api/approvals/:id` for Zig Todo webhook.
- Surface approval queues in frontend using Supabase realtime and signed URLs for artifacts.

## Track D — Planner APIs & Audit
- Endpoints: `POST /api/auto-planner/plan`, `POST /api/auto-planner/execute`, `POST /api/automation/override` implemented as Vercel Functions with Supabase transactions.
- Audit records link approvals, overrides, plans back to backlog items and packs; store snapshots in Supabase storage for forensic replay.
- Emit `plan.ready`, `plan.blocked`, `plan.approved` events through Supabase realtime + worker metrics.

---

## Deliverables
- Auto planner produces executable Supabase-backed plans with gate verdicts and cloud cost metrics.
- Human-in-the-loop gating for sensitive tools backed by Supabase approvals and Vercel webhooks.
- Audit trail and APIs that tie planner activity to backlog, packs, and approvals in the cloud.

## Exit Checklist
- [ ] Auto planner generates plans and records gate verdicts per step/model in Supabase tables.
- [ ] Human approval workflow operational with Vercel API endpoints and Supabase realtime updates.
- [ ] Overrides and approvals audited with storage snapshots and dashboard visibility.
- [ ] Feature flags allow planner/execute paths to roll out independently via Supabase config.

## Solo Workflow & Tests
1. **Track A** – build planner core. Run: `npm run test -- --runInBand tests/integration/autoPlanner.cloud.test.ts`.
2. **Track B** – add gate evaluators. Run: `npm run test -- --runInBand tests/unit/gateHandlers.cloud.test.ts`.
3. **Track C** – implement human approvals. Run: `npm run test -- --runInBand tests/integration/humanApproval.cloud.test.ts`.
4. **Track D** – expose APIs/audit. Run: `npm run lint`, `npm run gates`, and execute `npm run smoke:cloud -- --surface=planner`.

Check the exit list once all four tracks and tests pass against Supabase + Vercel environments.
