import crypto from 'node:crypto';
import type { ResponsesRequest } from '../../shared/openai/responsesSchemas';
import { ResponsesRunCoordinator } from './runCoordinator';
import type { ToolRequestConfig } from './toolRegistry';
import type { HistoryPlanInput, HistoryPlanner } from './historyPlanner';
import type { ConversationPolicy } from './conversationStateManager';

export interface ResponsesRunConfig {
  tenantId: string;
  runId?: string;
  request: Partial<ResponsesRequest> & { input: ResponsesRequest['input'] };
  metadata?: Record<string, string>;
  tools?: ToolRequestConfig;
  history?: HistoryPlanInput;
  conversationPolicy?: ConversationPolicy;
  maxToolCalls?: number;
  toolChoice?: ResponsesRequest['tool_choice'];
  background?: boolean;
}

export interface ResponsesRunResult {
  runId: string;
  request: ResponsesRequest;
  bufferedMessages: { id: string; text: string }[];
  reasoningSummaries: string[];
  refusals: string[];
  historyPlan?: ReturnType<HistoryPlanner['plan']>;
}

export class ResponsesRunService {
  constructor(private readonly coordinator: ResponsesRunCoordinator) {}

  async execute(config: ResponsesRunConfig): Promise<ResponsesRunResult> {
    const runId = config.runId ?? `run_${crypto.randomUUID()}`;
    this.assertToolConstraints(config);

    const runMetadata: Record<string, string> = {
      tenant_id: config.tenantId,
      ...(config.metadata ?? {}),
    };

    const start = await this.coordinator.startRun({
      runId,
      tenantId: config.tenantId,
      request: {
        ...config.request,
        metadata: {
          ...(config.request.metadata ?? {}),
          ...runMetadata,
        },
      },
      metadata: runMetadata,
      tools: config.tools,
      history: config.history,
      policy: config.conversationPolicy,
      maxToolCalls: config.maxToolCalls,
      toolChoice: config.toolChoice,
      background: config.background,
    });

    return {
      runId,
      request: start.request,
      bufferedMessages: this.coordinator.getBufferedMessages(runId),
      reasoningSummaries: this.coordinator.getBufferedReasoning(runId),
      refusals: this.coordinator.getBufferedRefusals(runId),
      historyPlan: start.historyPlan,
    };
  }

  private assertToolConstraints(config: ResponsesRunConfig) {
    if (config.maxToolCalls !== undefined) {
      if (!Number.isInteger(config.maxToolCalls) || config.maxToolCalls <= 0) {
        throw new Error('maxToolCalls must be a positive integer');
      }
      if (config.maxToolCalls > 16) {
        throw new Error('maxToolCalls cannot exceed 16');
      }
    }

    if (config.toolChoice && config.toolChoice !== 'auto' && config.toolChoice !== 'none') {
      if (config.toolChoice === 'required' && !config.tools) {
        throw new Error('toolChoice "required" specified without tool configuration');
      }
      if (typeof config.toolChoice === 'object' && config.toolChoice.type === 'function') {
        const requested = config.toolChoice.function.name;
        const includeList = config.tools?.include ?? [];
        if (!includeList.includes(requested)) {
          throw new Error(`toolChoice refers to ${requested} which is not included in tools`);
        }
      }
    }
  }
}
