# Registry API Reference

Thin wrapper documenting the registry endpoints and supporting scripts introduced in Phase 1C.

## REST Endpoints

| Endpoint | Method | Description | Notes |
| --- | --- | --- | --- |
| `/api/agents` | GET | List agents with query params `status`, `tag`, `search`, `limit` | Uses `listAgents` under the hood |
| `/api/agents/:id` | GET | Fetch agent detail + versions | maps to `getAgent` |
| `/api/agents/publish` | POST | Publish (requires admin auth) | see `scripts/registry/publishAgents.ts` |
| `/api/agents/validate` | POST | Validate manifest (admin only) | returns `{ valid, errors }` |
| `/api/agents/:id/rollback` | POST | Promote historical version | expects `{ targetVersion }` |
| `/api/templates` | GET | List templates | `listTemplates` |
| `/api/templates/:id` | GET | Fetch template detail | `getTemplate` |
| `/api/templates/publish` | POST | Publish template | see `scripts/registry/publishTemplates.ts` |
| `/api/templates/validate` | POST | Validate template manifest | returns `{ valid, errors }` |

## Unified Search Helper

- `src/services/registryIntegration.ts#searchRegistry(options)` returns an array combining `AgentSummary` and `TemplateSummary` results.
- Options: `search?: string`, `limit?: number` (defaults to 25).
- Each result exposes `type`, `id`, `name`, `status`, `tags`, `updatedAt`, and `relatedAgents` (for templates).

## CLI Scripts

| Script | Purpose |
| --- | --- |
| `npm run registry:agents:validate` | Validate agent manifests in `packages/shared/agents` and `registry/agents`. |
| `npm run registry:agents:publish` | Publish agents (set `REGISTRY_DRY_RUN=1` to skip writes). |
| `npm run registry:templates:validate` | Validate template manifests. |
| `npm run registry:templates:publish` | Publish template manifests. |
| `npm run registry:sync` | Validates + publishes agents/templates together. |

## Metrics

- `registry_operation_duration_ms{entity="agent", action="search"}` is emitted by unified search.
- `registry_operation_duration_ms{entity="template", action="search"}` captures template search latency.
- Additional metrics already exist for publish/rollback flows inside `src/lib/registry.ts`.

## Dry-Run Mode

- All publish scripts check the `REGISTRY_DRY_RUN` environment variable.
- Set `REGISTRY_DRY_RUN=1` locally and in CI to avoid touching the backing database.

## Enable Production Publishing

1. Set repository secrets/variables for database access.
2. Configure `REGISTRY_DRY_RUN=0` in GitHub repository variables.
3. Verify connections with a manual workflow dispatch (`Registry Publish`).
4. Monitor metrics for `registry_operation_duration_ms` and existing observability dashboards.