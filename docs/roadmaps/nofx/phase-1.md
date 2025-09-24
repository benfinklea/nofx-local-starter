# 🛠️ NOFX Control Plane · Phase 1 — Self-Configuring Registries

> Goal: let NOFX discover agents and templates from the repo without code changes, while giving contributors linting/validation so broken definitions never reach production.

---

## Track A — Agent Registry
- Filesystem contract: `packages/shared/agents/<agentId>/agent.json` plus optional `prompts/*.md`, `mcp.json`, `assets/`.
- Validation: Zod schema with semantic checks (unique skills, valid MCP URLs, resource profile limits). Failing entries go to a validation queue.
- Watcher: chokidar with debounce, `.draft` support, `__bulk_update.lock` to pause reloads during mass edits.
- Persistence: `agent_registry` table (id, metadata JSONB, prompt hash, state, version, updated_at).
- Integration: planBuilder accepts `agentId` or chooses by skills; worker injects prompts/MCP settings automatically.
- API & events: `GET /agents`, `GET /agents/:id`, `POST /agents/:id/rollback`; emit `agent.added/updated/removed/validation_failed`.
- Tests: schema validation, debounce watcher, rollback, and an integration fixture that asserts API output.

## Track B — Template Catalog
- Filesystem contract: `packages/shared/templates/<templateId>/template.json`, optional `prompts/*.md`, `assets/`, `docs.md`.
- Validation: requires `defaultPlan.steps[]`, `expectedOutputs`, `rollbackAdvice`, `supportedAgents`, `resourceProfile`.
- Registry: `template_registry` table with versioning/rollback mirroring agent behaviour.
- API: `GET /templates`, `POST /templates/:id/instantiate`, `POST /templates/validate`.
- Docs/tooling: update AI_CODER_GUIDE, add `npm run validate:templates` script.
- Tests: loader coverage + instantiation integration tests.

## Track C — Contributor Tooling
- `npm run validate:agents` / `npm run validate:templates` plus CI guard.
- Example agents/templates with source attribution.
- Documentation describing `.draft` workflow, lock file usage, and rollback commands.

---

## Deliverables
- Populated registries exposed over REST/events.
- Validation queue/quarantine so malformed definitions never auto-load.
- Contributor docs + scripts to keep AI coders aligned.

## Exit Checklist
- [ ] Agent registry hot-loads from filesystem with rollback + validation events.
- [ ] Template registry mirrors agent behaviour and instantiates plans.
- [ ] Validation scripts documented and wired into CI.
- [ ] Example definitions committed (with licensing notes) to serve as templates.

## Solo Workflow & Tests
1. **Track A** – build the agent loader/registry. When complete, run:
   ```bash
   npm run validate:agents
   npm run lint
   npm run typecheck
   npm run test -- --runInBand
   ```
2. **Track B** – implement the template catalog. Then run:
   ```bash
   npm run validate:templates
   npm run lint
   npm run typecheck
   npm run test -- --runInBand
   ```
3. **Track C** – update docs/scripts. Finish with:
   ```bash
   npm run gates
   ```
Only check the exit list when all three steps succeed.
