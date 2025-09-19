import { ToolRegistry } from '../../src/services/responses/toolRegistry';

const exampleFunctionTool = {
  name: 'persist_action_items',
  description: 'Persist structured action items to storage',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
          required: ['title'],
        },
      },
    },
    required: ['items'],
  },
} as const;

describe('ToolRegistry', () => {
  it('registers function tools and assembles request payloads', () => {
    const registry = new ToolRegistry();
    registry.registerFunctionTool(exampleFunctionTool);

    const tools = registry.buildToolPayload({
      include: ['persist_action_items'],
      builtin: ['web_search'],
    });

    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({ type: 'web_search' });
    expect(tools[1]).toMatchObject({
      type: 'function',
      name: 'persist_action_items',
      parameters: exampleFunctionTool.parameters,
    });
  });

  it('throws when registering duplicate function tools', () => {
    const registry = new ToolRegistry();
    registry.registerFunctionTool(exampleFunctionTool);
    expect(() => registry.registerFunctionTool(exampleFunctionTool)).toThrow('Function tool persist_action_items already registered');
  });

  it('validates requested tool list and rejects unknown names', () => {
    const registry = new ToolRegistry();
    registry.registerFunctionTool(exampleFunctionTool);
    expect(() => registry.buildToolPayload({ include: ['missing'] })).toThrow('Unknown tool missing');
  });
});
