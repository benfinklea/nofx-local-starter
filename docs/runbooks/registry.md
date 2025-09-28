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
