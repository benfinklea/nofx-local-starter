import { validateResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import { InMemoryResponsesArchive, type ResponsesArchive } from '../../shared/responses/archive';
import { ResponsesEventRouter } from '../../shared/responses/eventRouter';
import { ConversationStateManager, type ConversationPolicy } from './conversationStateManager';
import { RateLimitTracker, type RateLimitSnapshot } from './rateLimitTracker';
import { ToolRegistry, type ToolRequestConfig } from './toolRegistry';
import { StreamingBuffer, type StreamingEvent } from './streamBuffer';
import { HistoryPlanner, type HistoryPlanInput, type HistoryPlan } from './historyPlanner';

export interface ResponsesClient {
  create(request: ResponsesRequest & { stream?: false }): Promise<{ result: ResponsesResult; headers?: Record<string, string> }>;
}

type StartRunOptions = {
  runId: string;
  tenantId: string;
  request: ResponsesRequest | Partial<ResponsesRequest>;
  policy?: ConversationPolicy;
  metadata?: Record<string, string>;
  background?: boolean;
  previousResponseId?: string;
  existingConversationId?: string;
  tools?: ToolRequestConfig;
  history?: HistoryPlanInput;
  maxToolCalls?: number;
  toolChoice?: ResponsesRequest['tool_choice'];
};

type CoordinatorDeps = {
  archive?: ResponsesArchive;
  conversationManager: ConversationStateManager;
  client: ResponsesClient;
  rateLimitTracker?: RateLimitTracker;
  toolRegistry?: ToolRegistry;
  historyPlanner?: HistoryPlanner;
};

export class ResponsesRunCoordinator {
  private readonly archive: ResponsesArchive;

  private readonly conversationManager: ConversationStateManager;

  private readonly client: ResponsesClient;

  private readonly routers = new Map<string, ResponsesEventRouter>();

  private readonly buffers = new Map<string, StreamingBuffer>();

  private readonly rateLimitTracker: RateLimitTracker | undefined;

  private readonly toolRegistry: ToolRegistry;

  private readonly historyPlanner: HistoryPlanner | undefined;

  constructor(deps: CoordinatorDeps) {
    this.archive = deps.archive ?? new InMemoryResponsesArchive();
    this.conversationManager = deps.conversationManager;
    this.client = deps.client;
    this.rateLimitTracker = deps.rateLimitTracker;
    this.toolRegistry = deps.toolRegistry ?? new ToolRegistry();
    this.historyPlanner = deps.historyPlanner;
  }

  async startRun(options: StartRunOptions): Promise<{
    request: ResponsesRequest;
    context: { conversation?: string; storeFlag: boolean };
    historyPlan?: HistoryPlan;
  }> {
    const historyPlan = this.historyPlanner && options.history ? this.historyPlanner.plan(options.history) : undefined;
    const policy = this.resolvePolicy(options.policy, historyPlan);

    const context = await this.conversationManager.prepareContext({
      tenantId: options.tenantId,
      runId: options.runId,
      existingConversationId: options.existingConversationId,
      previousResponseId: options.previousResponseId,
      policy,
    });

    const requestPayload = validateResponsesRequest({
      ...options.request,
      model: options.request.model ?? 'gpt-4.1-mini',
      conversation: context.conversation,
      store: context.storeFlag,
      previous_response_id: context.previousResponseId,
      metadata: options.metadata ?? (options.request as ResponsesRequest).metadata,
      tools: options.tools ? this.toolRegistry.buildToolPayload(options.tools) : (options.request as ResponsesRequest).tools,
      max_tool_calls: options.maxToolCalls ?? (options.request as ResponsesRequest).max_tool_calls,
      tool_choice: options.toolChoice ?? (options.request as ResponsesRequest).tool_choice,
    });

    this.archive.startRun({ runId: options.runId, request: requestPayload, conversationId: context.conversation, metadata: requestPayload.metadata });
    const router = new ResponsesEventRouter({ runId: options.runId, archive: this.archive });
    this.routers.set(options.runId, router);
    this.buffers.set(options.runId, new StreamingBuffer());

    if (!options.background) {
      const { result, headers } = await this.client.create({ ...requestPayload, stream: false });
      this.captureRateLimits(headers);
      router.handleEvent({ type: 'response.completed', sequence_number: 1, response: result });
      this.buffers.get(options.runId)?.handleEvent({
        type: 'response.output_text.done',
        item_id: extractAssistantMessageId(result) ?? 'assistant',
        text: extractAssistantText(result),
      });
    }

    return {
      request: requestPayload,
      context: { conversation: context.conversation, storeFlag: context.storeFlag },
      historyPlan,
    };
  }

  handleEvent(runId: string, event: { type: string; sequence_number?: number; [key: string]: unknown }): void {
    const router = this.routers.get(runId);
    if (!router) {
      throw new Error(`router for run ${runId} not registered`);
    }
    router.handleEvent(event);
    this.buffers.get(runId)?.handleEvent(event as StreamingEvent);
  }

  getArchive(): ResponsesArchive {
    return this.archive;
  }

  getLastRateLimitSnapshot(): RateLimitSnapshot | undefined {
    return this.rateLimitTracker?.getLastSnapshot();
  }

  getBufferedMessages(runId: string) {
    return this.buffers.get(runId)?.getAssistantMessages() ?? [];
  }

  getBufferedReasoning(runId: string) {
    return this.buffers.get(runId)?.getReasoningSummaries() ?? [];
  }

  getBufferedRefusals(runId: string) {
    return this.buffers.get(runId)?.getRefusals() ?? [];
  }

  private resolvePolicy(policy: ConversationPolicy | undefined, plan?: HistoryPlan): ConversationPolicy | undefined {
    if (policy) return policy;
    if (plan?.strategy === 'vendor') return { strategy: 'vendor' };
    return undefined;
  }

  private captureRateLimits(headers?: Record<string, string>): void {
    if (!headers || !this.rateLimitTracker) return;
    this.rateLimitTracker.capture(headers);
  }
}

function extractAssistantMessageId(result: ResponsesResult): string | undefined {
  const message = result.output?.find((item) => item.type === 'message') as any;
  return message?.id;
}

function extractAssistantText(result: ResponsesResult): string | undefined {
  const message = result.output?.find((item) => item.type === 'message') as any;
  if (!message?.content) return undefined;
  const textPart = message.content.find((part: any) => part?.type === 'output_text');
  return textPart?.text;
}
