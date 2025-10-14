import type { ResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ResponsesRunConfig } from '../responses/runService';
import type { CompileTemplateOptions, BuilderTemplate } from './builderTypes';

function renderText(text: string, variables: Record<string, string>): string {
  const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  return text.replace(regex, (_match, key) => {
    const trimmed = key.trim();
    const value = variables[trimmed];
    if (value === undefined) {
      throw new Error(`Missing variable ${trimmed}`);
    }
    return value;
  });
}

function collectRequiredVariables(template: BuilderTemplate): Set<string> {
  const required = new Set<string>();
  for (const item of template.input) {
    if (item.type === 'input_text' && item.text) {
      const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(item.text)) !== null) {
        const captured = match[1];
        if (captured) {
          required.add(captured.trim());
        }
      }
    }
  }
  return required;
}

export function compileTemplateToRunConfig(options: CompileTemplateOptions): ResponsesRunConfig {
  const { template, variables, tenantId } = options;
  const required = collectRequiredVariables(template);
  for (const key of required) {
    if (!(key in variables)) {
      throw new Error(`Missing variable ${key}`);
    }
  }

  const metadata: Record<string, string> = {
    ...(template.metadata ?? {}),
    template_id: template.id,
    template_name: template.name,
    ...(options.metadata ?? {}),
  };

  const requestInputParts = [
    {
      role: 'user' as const,
      content: template.input.map((item) => {
        if (item.type === 'input_text') {
          return {
            type: 'input_text' as const,
            text: renderText(item.text ?? '', variables),
          };
        }
        if (item.type === 'input_image') {
          return {
            type: 'input_image' as const,
            image_url: renderText(item.image_url ?? '', variables),
          };
        }
        if (item.type === 'input_file') {
          return {
            type: 'input_file' as const,
            file_id: renderText(item.file_id ?? '', variables),
          };
        }
        if (item.type === 'input_audio') {
          return {
            type: 'input_audio' as const,
            audio: renderText(item.audio ?? '', variables),
            format: item.format,
          };
        }
        return item as any;
      }),
    },
  ];

  const instructions = renderText(template.instructions, variables);

  const request: Partial<ResponsesRequest> & { input: ResponsesRequest['input'] } = {
    model: template.model,
    input: requestInputParts as ResponsesRequest['input'],
    instructions,
    metadata,
    safety_identifier: template.safetyIdentifier,
  };

  return {
    tenantId,
    request,
    metadata: {
      template_id: template.id,
      template_name: template.name,
      ...(options.metadata ?? {}),
    },
    tools: template.tools,
    maxToolCalls: template.maxToolCalls,
    toolChoice: template.toolChoice,
    history: template.historyPlan,
    conversationPolicy: template.conversationPolicy,
  };
}
