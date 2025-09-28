# Template Best Practices

Templates pair declarative workflow descriptions with the agent registry. Follow these guidelines to keep definitions consistent and CI-friendly.

## Directory Layout

Templates live under `packages/shared/templates/<template-id>/`:

- `template.json` — `PublishTemplateRequest` payload with metadata and version pointer.
- `versions/<semver>.json` — resolved workflow graph for a specific release.
- `assets/` — optional supporting documents or images.

See `packages/shared/templates/example-workflow` for a reference implementation.

## Metadata Conventions

- Populate `metadata.agents` with the agent ids a template depends on. This fuels unified search and cross-linking.
- Record `metadata.owner` and `metadata.source` to keep audit trails.
- Use the `tags` array for discoverability (limit to 5 keywords).
- Group templates with `category` (e.g., `demo`, `ops`, `release`).

## Versioning and Files

- Treat `template.json` as the manifest for the latest active version.
- Store the full workflow definition in `versions/<semver>.json`.
- When bumping a template, create a new version file and update `template.json.version` and `content.versionFile`.

## Local Validation

```
npm run registry:templates:validate
REGISTRY_DRY_RUN=1 npm run registry:templates:publish
REGISTRY_DRY_RUN=1 npm run registry:sync
```

Running the sync script ensures both agents and templates are shaped correctly before pushing a branch.

## Testing Guidance

- Unit-test workflow helpers that manipulate template payloads.
- Extend integration tests (`tests/integration`) when new templates introduce API surfaces.
- Append fixtures with representative payloads for complex templates.

## Publishing Flow

1. Update files under `packages/shared/templates/<template-id>/`.
2. Run validation + dry-run publish commands.
3. Commit changes along with any documentation updates.
4. Open a PR; the `registry-validation` workflow will gate the change.
5. After merge, the `registry-publish` workflow pushes the update. Provide registry credentials + `REGISTRY_DRY_RUN=0` to ship for real.
