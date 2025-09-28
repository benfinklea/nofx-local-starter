# Registry Developer Tooling

Phase 1C introduces automation and guidance for working with the registry.

## CLI Commands

- `npm run registry:agents:validate`
- `npm run registry:agents:publish`
- `npm run registry:templates:validate`
- `npm run registry:templates:publish`
- `npm run registry:sync`

All publish commands respect `REGISTRY_DRY_RUN=1` to enable safe dry-runs.

## GitHub Actions

- `registry-validation.yml` validates manifests on PRs touching registry files.
- `registry-publish.yml` publishes on `main` with dry-run defaults.

## VS Code Extension (Planned)

- Provide schema-aware completions for `agent.json` and `template.json`.
- Add commands for running validation tasks.
- Surface quick-fix suggestions for missing metadata.

## Lefthook Integration (Backlog)

- Add optional hooks to run registry validations pre-commit when change volume increases.

## Unified Search Library

- `src/services/registryIntegration.ts` exports `searchRegistry` for building custom UIs or CLI experiences.