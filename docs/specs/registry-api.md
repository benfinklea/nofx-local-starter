# NOFX Agent & Template Registry API (Phase 1)

This document captures the shared contract for the Supabase-backed registries that Phase 1 will deliver. The definitions below align with the shared TypeScript types under `packages/shared/src/agents.ts` and `packages/shared/src/templates.ts`.

All routes are served from the Vercel API surface (e.g. `/api/agents`, `/api/templates`) and return JSON with the shapes described here. Unless otherwise noted, endpoints require an authenticated admin session.

---

## Agent Registry

### List Agents — `GET /api/agents`

**Query Parameters**
- `status` (optional) — filter by lifecycle (`draft`, `active`, `deprecated`, `disabled`)
- `tag` (optional) — filter to agents containing the tag
- `search` (optional) — case-insensitive search across `name`, `description`, `tags`
- `limit` (optional, default 25, max 100)
- `cursor` (optional) — pagination cursor from previous response

**Response**
```json
{
  "agents": [AgentSummary, ...],
  "nextCursor": "string | null"
}
```

### Get Agent Detail — `GET /api/agents/:agentId`

**Response**
```json
{
  "agent": AgentDetail
}
```

### Publish Agent — `POST /api/agents/publish`

**Body** — `PublishAgentRequest`

**Response**
```json
{
  "agent": AgentDetail
}
```

### Validate Agent Manifest — `POST /api/agents/validate`

**Body** — `PublishAgentRequest` (validation ignores persistence; only checks schema)

**Response**
```json
{
  "valid": true,
  "errors": []
}
```

### Roll Back Agent Version — `POST /api/agents/:agentId/rollback`

**Body**
```json
{
  "targetVersion": "string"
}
```

**Response**
```json
{
  "agent": AgentDetail
}
```

---

## Template Registry

### List Templates — `GET /api/templates`

**Query Parameters**
- `status`, `tag`, `category`, `search`, `limit`, `cursor` (same semantics as agents)

**Response**
```json
{
  "templates": [TemplateSummary, ...],
  "nextCursor": "string | null"
}
```

### Get Template Detail — `GET /api/templates/:templateId`

**Response**
```json
{
  "template": TemplateDetail
}
```

### Publish Template — `POST /api/templates/publish`

**Body** — `PublishTemplateRequest`

**Response**
```json
{
  "template": TemplateDetail
}
```

### Validate Template Draft — `POST /api/templates/validate`

**Body** — `PublishTemplateRequest`

**Response**
```json
{
  "valid": true,
  "errors": []
}
```

### Roll Back Template Version — `POST /api/templates/:templateId/rollback`

**Body**
```json
{
  "targetVersion": "string"
}
```

**Response**
```json
{
  "template": TemplateDetail
}
```

---

## Integration Expectations

- All responses include ISO timestamps; the shared interfaces expose them as strings.
- Pagination uses opaque cursors (`nextCursor`); clients include the value via `?cursor=` to fetch the next page.
- Publish endpoints must enforce idempotency using existing middleware (step inbox) keyed on `agentId + version` or `templateId + version`.
- Validation endpoints return `valid=false` with a non-empty `errors` array containing `{ field, message }` entries for display in tooling.
- Future consumers (Plan Builder, orchestration engine) should import the interfaces from `packages/shared/src` to avoid shape drift.

