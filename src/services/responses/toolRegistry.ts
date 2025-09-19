import type { ResponsesTool } from '../../shared/openai/responsesSchemas';

const BUILTIN_TOOL_NAMES = ['web_search', 'file_search', 'code_interpreter', 'computer', 'mcp'] as const;
export type BuiltinToolName = (typeof BUILTIN_TOOL_NAMES)[number];
const BUILTIN_TOOLS = new Set<string>(BUILTIN_TOOL_NAMES);

export interface FunctionToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface ToolRequestConfig {
  builtin?: BuiltinToolName[];
  include?: string[];
}

export class ToolRegistry {
  private readonly functionTools = new Map<string, FunctionToolDefinition>();

  registerFunctionTool(definition: FunctionToolDefinition): void {
    const name = definition.name.trim();
    if (!name) throw new Error('Function tool name is required');
    if (this.functionTools.has(name)) {
      throw new Error(`Function tool ${name} already registered`);
    }
    this.functionTools.set(name, { ...definition, name });
  }

  buildToolPayload(config: ToolRequestConfig): ResponsesTool[] {
    const payload: ResponsesTool[] = [];
    if (config.builtin) {
      for (const builtin of config.builtin) {
        if (!BUILTIN_TOOLS.has(builtin)) {
          throw new Error(`Unknown builtin tool ${builtin}`);
        }
        payload.push({ type: builtin } as ResponsesTool);
      }
    }

    if (config.include) {
      for (const name of config.include) {
        const tool = this.functionTools.get(name);
        if (!tool) throw new Error(`Unknown tool ${name}`);
        payload.push({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }

    return payload;
  }
}
