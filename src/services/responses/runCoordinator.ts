import { validateResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import { InMemoryResponsesArchive, type ResponsesArchive, type RunRecord } from '../../shared/responses/archive';
import { ResponsesEventRouter } from '../../shared/responses/eventRouter';
import { ConversationStateManager, type ConversationPolicy } from './conversationStateManager';
import { RateLimitTracker, type RateLimitSnapshot } from './rateLimitTracker';
import { ToolRegistry, type ToolRequestConfig } from './toolRegistry';
import { type StreamingEvent } from './streamBuffer';
import { HistoryPlanner, type HistoryPlanInput, type HistoryPlan } from './historyPlanner';
import { IncidentLog } from './incidentLog';
import { DelegationTracker } from './delegationTracker';

// Import extracted services
import { TracingService } from './coordinator/TracingService';
import { BufferService } from './coordinator/BufferService';
import { EventProcessingService } from './coordinator/EventProcessingService';
import { RequestPreparationService, type SpeechOptions } from './coordinator/RequestPreparationService';

export interface ResponsesClient {
  create(request: ResponsesRequest & { stream?: false }): Promise<{ result: ResponsesResult; headers?: Record<string, string> }>;
}

export type { SpeechOptions };

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
  private readonly rateLimitTracker: RateLimitTracker | undefined;
  private readonly toolRegistry: ToolRegistry;
  private readonly historyPlanner: HistoryPlanner | undefined;
  private readonly incidentLog: IncidentLog | undefined;
  private readonly delegationTracker: DelegationTracker | undefined;

  // Extracted services
  private readonly tracingService: TracingService;
  private readonly bufferService: BufferService;
  private readonly eventProcessingService: EventProcessingService;
  private readonly requestPreparationService: RequestPreparationService;

  constructor(deps: CoordinatorDeps) {
    this.archive = deps.archive ?? new InMemoryResponsesArchive();
    this.conversationManager = deps.conversationManager;
    this.client = deps.client;
    this.rateLimitTracker = deps.rateLimitTracker;
    this.toolRegistry = deps.toolRegistry ?? new ToolRegistry();
    this.historyPlanner = deps.historyPlanner;
    this.incidentLog = deps.incidentLog;
    this.delegationTracker = deps.delegationTracker;

    // Initialize extracted services
    this.tracingService = new TracingService();
    this.bufferService = new BufferService(this.archive);
    this.eventProcessingService = new EventProcessingService(
      this.archive,
      this.tracingService,
      this.incidentLog,
      this.delegationTracker,
      this.rateLimitTracker,
    );
    this.requestPreparationService = new RequestPreparationService(this.toolRegistry);
  }

  async startRun(options: StartRunOptions): Promise<{
    request: ResponsesRequest;
    context: { conversation?: string; storeFlag: boolean };
    historyPlan?: HistoryPlan;
  }> {
    const historyPlan = this.historyPlanner && options.history ? this.historyPlanner.plan(options.history) : undefined;
    const policy = this.requestPreparationService.resolvePolicy(options.policy, historyPlan);

    const context = await this.conversationManager.prepareContext({
      tenantId: options.tenantId,
      runId: options.runId,
      existingConversationId: options.existingConversationId,
      previousResponseId: options.previousResponseId,
      policy,
    });

    const requestPayload = this.requestPreparationService.prepareRequest({
      request: options.request,
      context: {
        conversation: context.conversation,
        storeFlag: context.storeFlag,
        previousResponseId: context.previousResponseId,
      },
      metadata: options.metadata,
      tools: options.tools,
      maxToolCalls: options.maxToolCalls,
      toolChoice: options.toolChoice,
      speech: options.speech,
    });

    const span = this.tracingService.startTracingSpan({ runId: options.runId, tenantId: options.tenantId }, requestPayload);
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
    this.bufferService.createBuffer(options.runId);

    if (!options.background) {
      const { result, headers } = await this.client.create({ ...requestPayload, stream: false });
      this.captureRateLimits(headers, options.tenantId);
      this.tracingService.recordTracingEvent(options.runId, 'response.completed', {
        status: result.status,
        usage_total_tokens: result.usage?.total_tokens,
      });
      router.handleEvent({ type: 'response.completed', sequence_number: 1, response: result });
      const buffer = this.bufferService.getBuffer(options.runId);
      if (buffer) {
        this.bufferService.seedBufferFromResult(buffer, result);
      }
      this.tracingService.finalizeSpan(options.runId, 'response.completed');
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
    this.bufferService.handleBufferEvent(runId, event as StreamingEvent);
    this.eventProcessingService.processEvent(runId, event);
  }

  getArchive(): ResponsesArchive {
    return this.archive;
  }

  getLastRateLimitSnapshot(tenantId?: string): RateLimitSnapshot | undefined {
    return this.rateLimitTracker?.getLastSnapshot(tenantId);
  }

  getBufferedMessages(runId: string) {
    return this.bufferService.getAssistantMessages(runId);
  }

  getBufferedReasoning(runId: string) {
    return this.bufferService.getReasoningSummaries(runId);
  }

  getBufferedRefusals(runId: string) {
    return this.bufferService.getRefusals(runId);
  }

  getBufferedOutputAudio(runId: string) {
    return this.bufferService.getOutputAudioSegments(runId);
  }

  getBufferedImages(runId: string) {
    return this.bufferService.getImageArtifacts(runId);
  }

  getBufferedInputTranscripts(runId: string) {
    return this.bufferService.getInputAudioTranscripts(runId);
  }

  resyncFromArchive(runId: string): void | Promise<void> {
    return this.bufferService.resyncFromArchive(runId);
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

  registerSafetyHash(runId: string, hashed: string) {
    this.archive.updateSafety?.(runId, { hashedIdentifier: hashed });
  }

  private captureRateLimits(headers: Record<string, string> | undefined, tenantId: string): void {
    if (!headers || !this.rateLimitTracker) return;
    this.rateLimitTracker.capture(headers, { tenantId });
  }
}