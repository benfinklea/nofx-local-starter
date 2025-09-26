# 🛠️ NOFX Control Plane · Phase 1 — Cloud-Native Registries

> Goal: run self-configuring registries entirely in the cloud so Vercel Functions and Supabase stay in sync without relying on local filesystem watchers.

---

## Track A — Cloud Agent Registry
- Repository contract remains `packages/shared/agents/<agentId>/agent.json` plus optional `prompts/*.md`, `mcp.json`, `assets/`.
- Create `npm run registry:publish agents` that bundles definitions and uploads them to Supabase storage, tagging each revision with commit SHA.
- Add Supabase edge function `registry_agents_sync` that validates payloads with Zod (unique skills, MCP URLs, resource profile limits) and writes to `agent_registry` table (state, version, metadata, prompt hash, updated_at).
- Provide Vercel API layer (`GET /api/agents`, `GET /api/agents/:id`, `POST /api/agents/:id/rollback`) backed by Supabase Row Level Security and caching headers.
- Worker polls Supabase `agent_registry` changes via realtime subscriptions; inject prompts/MCP settings during execution.
- Emit `agent.added/updated/removed/validation_failed` as Supabase events forwarded to Vercel Edge Middleware.

## Track B — Cloud Template Catalog
- Definitions stay in `packages/shared/templates/<templateId>/template.json` with optional `prompts/*.md`, `assets/`, `docs.md`.
- Introduce `npm run registry:publish templates` mirroring Track A; versions land in `template_registry` with rollback metadata.
- Supabase edge validation ensures `defaultPlan.steps[]`, `expectedOutputs`, `rollbackAdvice`, `supportedAgents`, `resourceProfile`.
- Add `POST /api/templates/:id/instantiate` and `POST /api/templates/validate` routes that operate against Supabase transactions to keep Vercel Function invocations idempotent.
- Document generated artifacts location in Supabase storage (e.g., `registry/templates/<templateId>/<version>`).

## Track C — Contributor & CI Tooling
- `npm run validate:agents` / `npm run validate:templates` run locally but also upload draft manifests to Supabase `registry_validation_reports` for collaborators.
- GitHub Action publishes registries on `main` merges and seeds preview environments on PRs using temporary Supabase schemas.
- Documentation describes draft workflow (`status=draft` flag) and how to promote to production via Vercel deploy hooks.

---

## Deliverables
- Cloud-backed agent and template registries with Supabase as the single source of truth.
- Publish/rollback APIs exposed via Vercel Functions, cached for edge delivery.
- Contributor workflow that pushes definitions to the cloud with validation gates.

## Exit Checklist
- [ ] `registry:publish` scripts upload agents/templates with commit metadata and validation artifacts.
- [ ] Supabase edge functions enforce schemas and populate registry tables with realtime change feeds.
- [ ] Vercel API routes serve registries with rollback + caching; events reach clients via Supabase realtime.
- [ ] Contributor docs cover draft publishing, CI previews, and rollback procedures.

## Solo Workflow & Tests
1. **Track A** – build agent registry pipeline. Run:
   ```bash
   npm run validate:agents
   npm run registry:publish agents -- --dry-run
   npm run test -- --runInBand tests/integration/agentRegistry.cloud.test.ts
   ```
2. **Track B** – ship template catalog. Run:
   ```bash
   npm run validate:templates
   npm run registry:publish templates -- --dry-run
   npm run test -- --runInBand tests/integration/templateCatalog.cloud.test.ts
   ```
3. **Track C** – wire CI + docs. Finish with:
   ```bash
   npm run gates
   ```
Only check the exit list when all three tracks succeed end-to-end in Supabase + Vercel.
