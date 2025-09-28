# Registry Contributor Onboarding

This runbook helps new contributors ship agent and template updates confidently.

## Prerequisites

- Git worktree created from the repo root (`git worktree add -b feat/<branch> worktrees/<branch>`).
- Node 20, npm 10, and local Supabase credentials (if running publish commands without dry-run).
- Familiarity with `AI_CODER_GUIDE.md` guardrails.

## Quick Start

1. **Install dependencies:** `npm ci`.
2. **Review examples:**
   - Agent: `packages/shared/agents/example-support`
   - Template: `packages/shared/templates/example-workflow`
3. **Run validations:**
   - `npm run registry:agents:validate`
   - `npm run registry:templates:validate`
4. **Exercise dry-run publishes:**
   - `REGISTRY_DRY_RUN=1 npm run registry:agents:publish`
   - `REGISTRY_DRY_RUN=1 npm run registry:templates:publish`
   - `REGISTRY_DRY_RUN=1 npm run registry:sync`
5. **Run targeted tests:**
   - `npx jest --runTestsByPath tests/unit/registry.store.test.ts`
   - `npx jest --runTestsByPath tests/performance/registry.performance.test.ts`
   - `npx ts-node scripts/security/scanRegistryRoutes.ts`
6. **Open a PR:** include dry-run logs and link any related docs.

## CI/CD Expectations

- Pull requests trigger `Registry Validation` to keep manifests healthy.
- Merges to `main` trigger `Registry Publish` (dry-run by default). Coordinate with maintainers before flipping to production mode.

## Unified Search

The `searchRegistry` helper at `src/services/registryIntegration.ts` powers downstream UIs. After adding new agents or templates, run the targeted unit test to ensure the aggregation logic stays green:

```
npx jest --runTestsByPath tests/unit/registry.integration.service.test.ts
```

## Developer Tooling Roadmap

- **VS Code extension (planned):** expose schema completions + validation shortcuts.
- **CLI wrappers:** the `npm run registry:*` scripts act as the first step; contributions that enhance DX (e.g., `pnpm` compatibility) should keep the npm default intact.
- **Pre-commit hooks:** integrate registry validations into Lefthook profiles once change volume increases.

## Support

- **Registry SMEs:** #registry channel in Slack.
- **Database migrations:** coordinate with the Supabase owners before altering schema or RLS policies.
- **Incidents:** document learnings in `docs/runbooks/registry.md` (create if missing).
