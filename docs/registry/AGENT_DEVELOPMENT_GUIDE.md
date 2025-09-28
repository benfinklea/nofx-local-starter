# Agent Development Guide

Use this guide to add or iterate on agents that ship through the NOFX registry pipeline.

## Directory Layout

Agents live under `packages/shared/agents/<agent-id>/`:

- `agent.json` — payload consumed by registry scripts (`PublishAgentRequest`).
- `mcp.json` — optional MCP manifest exposed to tools.
- `prompts/` — prompt fragments referenced from the manifest.
- `assets/` — supporting collateral (keep text-friendly or store big assets elsewhere).

A working example is provided at `packages/shared/agents/example-support`.

## Authoring Checklist

1. **Clone the example** into a new subdirectory that matches the agent id.
2. **Update `agent.json`:**
   - `agentId`, `name`, `version`, and `manifest` fields are required.
   - List each capability in both the manifest and the top-level `capabilities` array.
   - Keep tags short and scoped (3-5 tags is ideal).
3. **Wire prompts** referenced by the manifest into `prompts/`.
4. **Add assets** such as diagrams or PDF attachments to `assets/` (optional).
5. **Record ownership** metadata (`metadata.owner`, `metadata.source`).

## Local Validation

Run the following commands from a worktree to validate definitions:

```bash
npm run registry:agents:validate
REGISTRY_DRY_RUN=1 npm run registry:agents:publish
REGISTRY_DRY_RUN=1 npm run registry:sync
```

The `REGISTRY_DRY_RUN=1` flag skips database writes while still exercising publish flows.

## GitHub Automation

Two workflows enforce registry quality:

- `.github/workflows/registry-validation.yml` runs on pull requests touching agent definitions.
- `.github/workflows/registry-publish.yml` runs on `main` (dry-run by default). Set the `REGISTRY_DRY_RUN` repository variable to `0` and supply registry credentials to enable production publishing.

## Unified Search

The new service `src/services/registryIntegration.ts` powers `/api` consumers with a unified agent + template index. When adding a new agent, ensure the templates that depend on it declare the relationship in `metadata.agents` so search results link entities correctly.

## Release Checklist

- [ ] `npm run registry:agents:validate` passes.
- [ ] `REGISTRY_DRY_RUN=1 npm run registry:agents:publish` passes.
- [ ] `REGISTRY_DRY_RUN=1 npm run registry:sync` passes.
- [ ] Documentation updated (this guide + template docs if applicable).
- [ ] PR includes screenshots or logs from dry-run publish.
