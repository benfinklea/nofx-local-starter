# Agents Package Layout

Each subdirectory contains a portable agent definition consumed by the registry pipeline. Files must remain JSON or Markdown to simplify validation in CI.

```
packages/shared/agents/
└── <agent-id>/
    ├── agent.json          # PublishAgentRequest payload consumed by scripts/registry
    ├── mcp.json            # Optional MCP manifest or metadata blob
    ├── prompts/            # Prompt fragments referenced from manifest
    └── assets/             # Binary or supplementary assets (kept lightweight)
```

The example `example-support` agent demonstrates the minimum fields required by `validateAgent`.
