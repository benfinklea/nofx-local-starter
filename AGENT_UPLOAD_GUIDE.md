# Agent Upload Guide

## Quick Start

You now have a simple drag-and-drop interface to manage AI agents!

### Access the Agent Manager

1. Start your app: `npm run dev`
2. Navigate to: **Agents** (in the top navigation)
3. You'll see the Agent Registry page

### Upload an Agent

**Option 1: Drag and Drop**
- Drag an `agent.json` file onto the upload area
- Agent is automatically validated and published
- Appears in the agent list immediately

**Option 2: Click to Browse**
- Click the upload area
- Select your `agent.json` file
- Upload completes automatically

**Option 3: Use the CLI** (batch upload)
```bash
npm run registry:agents:publish
```
This uploads all agents from:
- `registry/agents/*.json`
- `packages/shared/agents/*/agent.json`

### Agent JSON Format

```json
{
  "agentId": "unique-agent-id",
  "name": "Human Readable Name",
  "description": "What this agent does",
  "manifest": {
    "entry": "path/to/agent/code.ts",
    "model": "gpt-4o",
    "capabilities": ["skill1", "skill2"]
  },
  "version": "1.0.0",
  "capabilities": [
    {
      "id": "skill1",
      "label": "Skill Name",
      "description": "What this skill does"
    }
  ],
  "tags": ["tag1", "tag2"]
}
```

### Manage Agents

**View All Agents**
- Scroll down to see all registered agents
- Each card shows: name, description, capabilities, tags, version

**Delete an Agent**
- Click the "Delete" button on any agent card
- Confirm the deletion
- Agent is soft-deleted (status set to 'disabled')

### Example Agent

See `registry/agents/example-code-generator.json` for a complete example.

### Use Agents in Orchestration

Once uploaded, agents are automatically available for orchestration:

```typescript
// Example: Select agents with TypeScript capability
const session = await selectAgentsForOrchestration({
  requiredCapabilities: [
    { skillId: 'typescript' }
  ],
  orchestrationType: 'solo'
});
```

The orchestration system will find all agents with the required capabilities and select the best one based on your criteria.

## Features

✅ **Drag-and-drop upload** - No technical knowledge required
✅ **Instant validation** - JSON checked before publishing
✅ **Live agent list** - See all registered agents
✅ **One-click delete** - Remove unwanted agents
✅ **Auto-discovery** - Agents available immediately for orchestration
✅ **Capability matching** - Smart agent selection based on skills

## Next Steps

- Upload more agents to build your agent library
- Use orchestration to coordinate multiple agents
- Monitor agent performance (coming soon)
- A/B test agent improvements (coming soon)

## Troubleshooting

**Upload fails with "Invalid JSON"**
- Check your JSON file is valid (use a JSON validator)
- Ensure all required fields are present

**Agent doesn't appear in list**
- Refresh the page
- Check the upload succeeded (look for success message)
- Verify agent status is 'active' in database

**Delete doesn't work**
- Agents are soft-deleted (status = 'disabled')
- They won't appear in the list but exist in database
- To permanently delete, use database admin tools
