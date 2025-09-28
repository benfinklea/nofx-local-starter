# Templates Package Layout

Templates keep versioned workflow definitions alongside metadata that powers the registry API.

```
packages/shared/templates/
└── <template-id>/
    ├── template.json        # PublishTemplateRequest payload
    ├── versions/
    │   └── <semver>.json    # Resolved workflow graph referenced by template.json
    └── assets/              # Optional artifacts (diagrams, schema exports)
```

The `example-workflow` template showcases how to reference an agent defined in `packages/shared/agents`.
