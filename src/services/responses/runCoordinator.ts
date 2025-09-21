import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';
import { validateResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import { InMemoryResponsesArchive, type ResponsesArchive, type RunRecord, type TimelineSnapshot } from '../../shared/responses/archive';
import { ResponsesEventRouter } from '../../shared/responses/eventRouter';
import { ConversationStateManager, type ConversationPolicy } from './conversationStateManager';
import { RateLimitTracker, type RateLimitSnapshot } from './rateLimitTracker';
import { ToolRegistry, type ToolRequestConfig } from './toolRegistry';
import { StreamingBuffer, type StreamingEvent } from './streamBuffer';
import { HistoryPlanner, type HistoryPlanInput, type HistoryPlan } from './historyPlanner';
import { IncidentLog } from './incidentLog';
import { DelegationTracker } from './delegationTracker';

export interface ResponsesClient {
  create(request: ResponsesRequest & { stream?: false }): Promise<{ result: ResponsesResult; headers?: Record<string, string> }>;
}

export interface SpeechOptions {
  mode: 'server_vad' | 'manual';
  inputFormat?: 'wav' | 'mp3' | 'pcm16';
  transcription?: {
    enabled: boolean;
    model?: string;
  };
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
  speech?: SpeechOptions;
};

type CoordinatorDeps = {
  archive?: ResponsesArchive;
  conversationManager: ConversationStateManager;
  client: ResponsesClient;
  rateLimitTracker?: RateLimitTracker;
  toolRegistry?: ToolRegistry;
  historyPlanner?: HistoryPlanner;
  incidentLog?: IncidentLog;
  delegationTracker?: DelegationTracker;
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

  private readonly delegationTracker: DelegationTracker | undefined;

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
    this.delegationTracker = deps.delegationTracker;
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

    const mergedMetadata: Record<string, string> = {
      ...(((options.request as ResponsesRequest).metadata) ?? {}),
      ...(options.metadata ?? {}),
    };
    applySpeechMetadata(mergedMetadata, options.speech);

    const requestPayload = validateResponsesRequest({
      ...options.request,
      model: options.request.model ?? 'gpt-4.1-mini',
      conversation: context.conversation,
      store: context.storeFlag,
      previous_response_id: context.previousResponseId,
      metadata: Object.keys(mergedMetadata).length ? mergedMetadata : undefined,
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
      const buffer = this.buffers.get(options.runId);
      if (buffer) {
        seedBufferFromResult(buffer, result);
      }
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
    this.delegationTracker?.handleEvent(runId, event as any);
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

  getBufferedOutputAudio(runId: string) {
    return this.buffers.get(runId)?.getOutputAudioSegments() ?? [];
  }

  getBufferedImages(runId: string) {
    return this.buffers.get(runId)?.getImageArtifacts() ?? [];
  }

  getBufferedInputTranscripts(runId: string) {
    return this.buffers.get(runId)?.getInputAudioTranscripts() ?? [];
  }

  resyncFromArchive(runId: string): void | Promise<void> {
    const maybeTimeline = this.archive.getTimeline(runId);
    if (!maybeTimeline) return;
    if (maybeTimeline instanceof Promise) {
      return maybeTimeline.then((snapshot) => {
        if (snapshot) this.populateBufferFromTimeline(runId, snapshot);
      });
    }
    this.populateBufferFromTimeline(runId, maybeTimeline);
  }

  private populateBufferFromTimeline(runId: string, timeline: TimelineSnapshot): void {
    const buffer = new StreamingBuffer();
    for (const event of timeline.events) {
      buffer.handleEvent(event as unknown as StreamingEvent);
    }
    if (timeline.run.result) {
      seedBufferFromResult(buffer, timeline.run.result);
    }
    this.buffers.set(runId, buffer);
  }

  getDelegations(runId: string) {
    if (this.delegationTracker) {
      return this.delegationTracker.getDelegations(runId);
    }
    const run = this.archive.getRun?.(runId);
    if (run instanceof Promise) {
      return [];
    }
    return run?.delegations ?? [];
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

function seedBufferFromResult(buffer: StreamingBuffer, result: ResponsesResult): void {
  let fallbackIndex = 0;
  for (const item of result.output ?? []) {
    if (item && item.type === 'reasoning') {
      const reasoningId = typeof (item as any).id === 'string' && (item as any).id.length
        ? (item as any).id
        : `reasoning_${++fallbackIndex}`;
      const summaries = collectReasoningSummaries(item as any);
      for (const text of summaries) {
        buffer.handleEvent({
          type: 'response.reasoning_summary_part.done',
          item_id: reasoningId,
          part: { type: 'summary_text', text },
        });
      }
      continue;
    }
    if (item.type !== 'message' || (item as any).role !== 'assistant') continue;
    const message = item as any;
    const itemId = typeof message.id === 'string' && message.id.length ? message.id : `assistant_${++fallbackIndex}`;
    buffer.handleEvent({
      type: 'response.output_item.added',
      item: { id: itemId, type: 'message', role: 'assistant' },
    });

    const parts: any[] = Array.isArray(message.content) ? message.content : [];
    parts.forEach((part) => {
      switch (part.type) {
        case 'output_text':
          buffer.handleEvent({
            type: 'response.output_text.done',
            item_id: itemId,
            text: part.text,
          });
          break;
        case 'reasoning':
          if (part.text) {
            buffer.handleEvent({
              type: 'response.reasoning_summary_part.done',
              item_id: itemId,
              part: { type: 'summary_text', text: part.text },
            });
          }
          break;
        case 'output_audio':
          if (part.audio) {
            buffer.handleEvent({
              type: 'response.output_audio.delta',
              item_id: itemId,
              delta: part.audio,
            });
          }
          buffer.handleEvent({ type: 'response.output_audio.done', item_id: itemId });
          if (part.transcript) {
            buffer.handleEvent({
              type: 'response.output_audio_transcript.done',
              item_id: itemId,
              transcript: part.transcript,
            });
          }
          break;
        case 'tool_call_delta':
          // ignore tool call deltas for synchronous replay
          break;
        default:
          break;
      }
    });
  }
}

function applySpeechMetadata(target: Record<string, string>, speech?: SpeechOptions): void {
  if (!speech) return;
  target.speech_mode = speech.mode;
  if (speech.inputFormat) {
    target.speech_input_format = speech.inputFormat;
  }
  if (speech.transcription) {
    target.speech_transcription = speech.transcription.enabled ? 'enabled' : 'disabled';
    if (speech.transcription.model) {
      target.speech_transcription_model = speech.transcription.model;
    }
  }
}

function collectReasoningSummaries(item: { [key: string]: unknown }): string[] {
  const summaries: string[] = [];
  const candidates: unknown[] = [];

  const maybeArrays = ['reasoning', 'output', 'content'] as const;
  for (const key of maybeArrays) {
    const value = item[key];
    if (Array.isArray(value)) {
      candidates.push(...value);
    }
  }

  const pushText = (value: unknown) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (value.trim().length) summaries.push(value);
      return;
    }
    if (typeof value !== 'object') return;
    const part = value as { [key: string]: unknown };
    if (part.type === 'reasoning' && typeof part.text === 'string' && part.text.trim().length) {
      summaries.push(part.text);
    } else if (typeof part.text === 'string' && part.text.trim().length) {
      summaries.push(part.text);
    }
  };

  candidates.forEach(pushText);
  if (typeof item.text === 'string' && item.text.trim().length) {
    summaries.push(item.text);
  }

  return Array.from(new Set(summaries));
}
