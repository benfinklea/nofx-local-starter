# Agent & Template Registry Runbook

## Overview
The registry stores published agents and templates in Supabase (`nofx.agent_registry`, `nofx.template_registry`). API handlers live under `/api/agents/*` and `/api/templates/*`, backed by `src/lib/registry.ts`.

## Prerequisites
- Supabase migrations applied (check for `20250201000100_agent_registry.sql` and `20250201000110_template_registry.sql`).
- Environment configured with `DATABASE_URL` for the API/worker processes.
- Admin session cookie or API token for invoking protected endpoints.

## Validating Registry Definitions
Use the CLI helper to lint manifests before publishing:

```bash
npm run registry:agents:validate path/to/agents
```

- Accepts either a directory of JSON files or a single JSON file (array or object).
- Fails with non-zero exit if any manifest is invalid.

Templates follow the same pattern via `npm run registry:sync` (validation happens automatically before publish).

## Publishing Agents/Templates
### Via CLI
```bash
npm run registry:agents:publish path/to/agents
npm run registry:sync path/to/registry
```
Each publish call is idempotent (`registry:agent:{agentId}:{version}` inbox key) and safe to re-run.

### Via API
```
POST /api/agents/publish
POST /api/templates/publish
```
Body matches `PublishAgentRequest` / `PublishTemplateRequest`. Duplicate publishes return `202` with `{ status: "skipped" }`.

## Rollback
```
POST /api/agents/:agentId/rollback { "targetVersion": "1.0.0" }
POST /api/templates/:templateId/rollback { "targetVersion": "1.0.0" }
```
Rollbacks reactivate the selected version and archive the current one. Observability logs appear with `registry.agent.rollback` / `registry.template.rollback` events.

## Monitoring & Observability
- Metrics: `registry_operation_duration_ms{entity="agent",action="publish"}` etc.
- Logs: look for `registry.agent.published`, `registry.template.published` in the aggregated log stream or Supabase query logs for auditing.
- Failures bubble up as `500` responses; check application logs with the correlation ID returned in the body.

### Alerting Playbook
- Create a Prometheus alert rule on `registry_operation_duration_ms` with `sum(rate(... [5m]))` to flag p95 latency > 200ms for five minutes, notify `#ops-registry` in Slack.
- Add a counter alert on `registry_operation_duration_ms{action="publish"}` error rate: `increase(http_requests_total{route="/api/agents/publish",status=~"5.."}[5m]) > 0`.
- Watch `registry_operation_duration_ms{action="rollback"}` for spikes; tie PagerDuty `registry-publish-failed` service to this rule.
- Surface these alerts in Grafana using the "Registry Operations" dashboard (provisioned under `docs/observability/`); include runbook links back to this document.

### Dashboards
- Panel 1: Agent/template publish latency (p50/p95) with alert banner.
- Panel 2: Publish throughput vs. failures by entity.
- Panel 3: Template rating volume (reads `nofx.template_feedback`).
- Panel 4: Supabase connection errors (query `pg_stat_activity` via existing datasource).

## Troubleshooting
1. **Schema missing** – Registry operations throw `Agent/template registry tables are missing`; run Supabase migrations.
2. **Duplicate publish** – API returns `202 skipped`; ensure version bump or run `rollback` prior to re-publish.
3. **Supabase errors** – Inspect Postgres logs; the API wraps operations in transactions, so partial writes should roll back automatically.
4. **Inbox cleanup** – If publishes get stuck due to inbox residue, manually delete the key from `nofx.inbox` or run `store.inboxDelete` via REPL.

## On-call Checklist
- Confirm migrations applied (`select * from nofx.agent_registry limit 1`).
- Use CLI `registry:agents:validate` before emergency publishes.
- Monitor metrics dashboards for spikes in publish latency.
- Update this runbook when new registry features land (search, analytics, etc.).

## Security Audit Checklist
- Verify admin authentication: `/api/agents/*` and `/api/templates/*` must return `401` without the signed admin cookie or `ENABLE_ADMIN` flag.
- Run `npx ts-node scripts/security/scanRegistryRoutes.ts` (see below) to ensure no new routes bypass auth middleware.
- Confirm Supabase RLS policies are enabled for `nofx.agent_registry`, `agent_versions`, `template_registry`, `template_versions`, `template_usage_daily`, and `template_feedback` (`alter table ... enable row level security` present in migrations).
- Execute the monthly OWASP quick scan (Burp/ZAP) against `/api/agents` and `/api/templates`; attach reports to the security vault.
- Audit usage tracking: ensure `REGISTRY_DRY_RUN=0` deployments call `trackUsage` so billing reconciliation can flag anomalous publish volume.

### Automated Scan Script
`scripts/security/scanRegistryRoutes.ts` performs a static check that every registry route imports `isAdmin()` and returns `401` when authentication is missing. Run with `npx ts-node scripts/security/scanRegistryRoutes.ts`; wire it into the security gate before deploying auth changes.

## Backup & Recovery
- **Daily snapshot**: schedule Supabase `pg_dump` of `nofx.agent_registry*` and `nofx.template_*` tables to S3 (`scripts/backups/exportRegistry.sh`). Retain 14 days.
- **Warm restore drill**: quarterly, restore latest snapshot into staging, run `npm run registry:sync` in dry-run mode to validate data integrity, and execute a read-only smoke test against `/api/agents` + `/api/templates`.
- **Disaster procedure**: if primary Supabase fails, provision standby, apply latest migrations (`supabase/migrations/*.sql`), restore snapshot, re-run `npm run registry:agents:publish` with `REGISTRY_DRY_RUN=0` after verifying `registry.publishAgents.cli.dryRun` logs show success.
- **Verification**: track backup job in Ops calendar; failure should page `oncall-registry` and block deploys until a healthy backup is captured.
