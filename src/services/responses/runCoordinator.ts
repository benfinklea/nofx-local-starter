import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';
import { validateResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import { InMemoryResponsesArchive, type ResponsesArchive, type RunRecord } from '../../shared/responses/archive';
import { ResponsesEventRouter } from '../../shared/responses/eventRouter';
import { ConversationStateManager, type ConversationPolicy } from './conversationStateManager';
import { RateLimitTracker, type RateLimitSnapshot } from './rateLimitTracker';
import { ToolRegistry, type ToolRequestConfig } from './toolRegistry';
import { StreamingBuffer, type StreamingEvent } from './streamBuffer';
import { HistoryPlanner, type HistoryPlanInput, type HistoryPlan } from './historyPlanner';
import { IncidentLog } from './incidentLog';

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
  safety?: { hashedIdentifier?: string };
};

type CoordinatorDeps = {
  archive?: ResponsesArchive;
  conversationManager: ConversationStateManager;
  client: ResponsesClient;
  rateLimitTracker?: RateLimitTracker;
  toolRegistry?: ToolRegistry;
  historyPlanner?: HistoryPlanner;
  incidentLog?: IncidentLog;
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

  private readonly incidentLog: IncidentLog | undefined;

  private readonly spans = new Map<string, Span>();

  private readonly tracer = trace.getTracer('responses.runCoordinator');

  constructor(deps: CoordinatorDeps) {
    this.archive = deps.archive ?? new InMemoryResponsesArchive();
    this.conversationManager = deps.conversationManager;
    this.client = deps.client;
    this.rateLimitTracker = deps.rateLimitTracker;
    this.toolRegistry = deps.toolRegistry ?? new ToolRegistry();
    this.historyPlanner = deps.historyPlanner;
    this.incidentLog = deps.incidentLog;
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

    const span = this.startTracingSpan(options, requestPayload);
    const traceId = span?.spanContext().traceId;

    this.archive.startRun({
      runId: options.runId,
      request: requestPayload,
      conversationId: context.conversation,
      metadata: requestPayload.metadata,
      traceId,
      safety: options.safety,
    });
    const router = new ResponsesEventRouter({ runId: options.runId, archive: this.archive });
    this.routers.set(options.runId, router);
    this.buffers.set(options.runId, new StreamingBuffer());

    if (!options.background) {
      const { result, headers } = await this.client.create({ ...requestPayload, stream: false });
      this.captureRateLimits(headers, options.tenantId);
      this.recordTracingEvent(options.runId, 'response.completed', {
        status: result.status,
        usage_total_tokens: result.usage?.total_tokens,
      });
      router.handleEvent({ type: 'response.completed', sequence_number: 1, response: result });
      this.buffers.get(options.runId)?.handleEvent({
        type: 'response.output_text.done',
        item_id: extractAssistantMessageId(result) ?? 'assistant',
        text: extractAssistantText(result),
      });
      this.finalizeSpan(options.runId, 'response.completed');
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
    this.recordTracingEvent(runId, event.type, { sequence: event.sequence_number ?? event.sequenceNumber });
    router.handleEvent(event);
    this.buffers.get(runId)?.handleEvent(event as StreamingEvent);
    this.processSafetyHooks(runId, event);
    this.processIncidentHooks(runId, event);
    if (this.isTerminalEvent(event.type)) {
      const status = event.type === 'response.failed' ? 'error' : event.type;
      this.finalizeSpan(runId, status, event);
    }
  }

  getArchive(): ResponsesArchive {
    return this.archive;
  }

  getLastRateLimitSnapshot(tenantId?: string): RateLimitSnapshot | undefined {
    return this.rateLimitTracker?.getLastSnapshot(tenantId);
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

  registerSafetyHash(runId: string, hashed: string) {
    this.archive.updateSafety?.(runId, { hashedIdentifier: hashed });
  }

  private processSafetyHooks(runId: string, event: { type: string }): void {
    if (event.type === 'response.refusal.done') {
      this.archive.updateSafety?.(runId, { refusalLoggedAt: new Date() });
      this.recordTracingEvent(runId, 'responses.refusal.recorded');
    }
  }

  private processIncidentHooks(runId: string, event: { type: string; sequence_number?: number; [key: string]: unknown }): void {
    if (!this.incidentLog) return;
    if (event.type === 'response.failed' || event.type === 'response.incomplete') {
      const runCandidate = this.archive.getRun?.(runId);
      const run: RunRecord | undefined = runCandidate instanceof Promise ? undefined : runCandidate;
      const tenantId = run?.metadata?.tenant_id ?? run?.metadata?.tenantId;
      const lastRate = tenantId ? this.rateLimitTracker?.getLastSnapshot(tenantId) : this.rateLimitTracker?.getLastSnapshot();
      this.incidentLog.recordIncident({
        runId,
        type: event.type === 'response.failed' ? 'failed' : 'incomplete',
        sequence: (event.sequence_number ?? event.sequenceNumber ?? 0) as number,
        occurredAt: new Date(),
        tenantId,
        model: run?.request?.model,
        requestId: lastRate?.requestId,
        traceId: run?.traceId,
        reason: JSON.stringify(event),
      });
      this.recordTracingEvent(runId, 'responses.incident.recorded');
    }
    if (event.type === 'response.completed') {
      this.incidentLog.resolveIncidentsByRun(runId, {
        resolvedBy: 'system',
        disposition: 'manual',
        linkedRunId: runId,
      });
    }
  }

  private isTerminalEvent(type: string): boolean {
    return type === 'response.completed' || type === 'response.failed' || type === 'response.cancelled' || type === 'response.incomplete';
  }

  private startTracingSpan(options: StartRunOptions, request: ResponsesRequest): Span {
    const span = this.tracer.startSpan('responses.run', {
      attributes: {
        'responses.run_id': options.runId,
        'responses.tenant_id': options.tenantId,
        'responses.model': request.model,
        'responses.store_flag': request.store ?? false,
        'responses.conversation_id': request.conversation && typeof request.conversation === 'string' ? request.conversation : undefined,
      },
    });
    this.spans.set(options.runId, span);
    return span;
  }

  private recordTracingEvent(runId: string, name: string, attributes: Record<string, unknown> = {}) {
    const span = this.spans.get(runId);
    if (!span) return;
    const filtered: Attributes = Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => value !== undefined),
    ) as Attributes;
    span.addEvent(name, filtered);
  }

  private finalizeSpan(runId: string, status: string, payload?: unknown) {
    const span = this.spans.get(runId);
    if (!span) return;
    if (status === 'response.failed' || status === 'error') {
      span.setStatus({ code: SpanStatusCode.ERROR, message: typeof payload === 'object' ? JSON.stringify(payload) : undefined });
    } else {
      span.setStatus({ code: SpanStatusCode.UNSET });
    }
    this.spans.delete(runId);
    span.end();
  }

  private captureRateLimits(headers: Record<string, string> | undefined, tenantId: string): void {
    if (!headers || !this.rateLimitTracker) return;
    this.rateLimitTracker.capture(headers, { tenantId });
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
