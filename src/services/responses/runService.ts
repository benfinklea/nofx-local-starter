import crypto from 'node:crypto';
import type { ResponsesRequest } from '../../shared/openai/responsesSchemas';
import { ResponsesRunCoordinator } from './runCoordinator';
import type { ToolRequestConfig } from './toolRegistry';
import type { HistoryPlanInput, HistoryPlanner } from './historyPlanner';
import type { ConversationPolicy } from './conversationStateManager';
import type { SafetySnapshot, RunRecord } from '../../shared/responses/archive';

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
  traceId?: string;
  safety?: SerializedSafetySnapshot;
}

type SerializedSafetySnapshot = {
  hashedIdentifier?: string;
  refusalCount: number;
  lastRefusalAt?: string;
  moderatorNotes: Array<{
    reviewer: string;
    note: string;
    disposition: string;
    recordedAt: string;
  }>;
};

export class ResponsesRunService {
  constructor(private readonly coordinator: ResponsesRunCoordinator) {}

  async execute(config: ResponsesRunConfig): Promise<ResponsesRunResult> {
    const runId = config.runId ?? `run_${crypto.randomUUID()}`;
    this.assertToolConstraints(config);

    const normalizedRequest = { ...config.request };
    let hashedSafetyIdentifier: string | undefined;
    if (normalizedRequest.safety_identifier) {
      hashedSafetyIdentifier = ensureSafetyHash(normalizedRequest.safety_identifier);
      normalizedRequest.safety_identifier = hashedSafetyIdentifier;
    }

    const runMetadata: Record<string, string> = {
      tenant_id: config.tenantId,
      ...(config.metadata ?? {}),
    };
    if (hashedSafetyIdentifier) {
      runMetadata.safety_identifier_hash = hashedSafetyIdentifier;
    }

    const start = await this.coordinator.startRun({
      runId,
      tenantId: config.tenantId,
      request: {
        ...normalizedRequest,
        metadata: {
          ...(normalizedRequest.metadata ?? {}),
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
      safety: hashedSafetyIdentifier ? { hashedIdentifier: hashedSafetyIdentifier } : undefined,
    });

    if (hashedSafetyIdentifier) {
      this.coordinator.registerSafetyHash(runId, hashedSafetyIdentifier);
    }

    const archive = this.coordinator.getArchive();
    let runRecord: RunRecord | undefined;
    const maybeRun = archive.getRun?.(runId);
    if (maybeRun instanceof Promise) {
      runRecord = await maybeRun;
    } else {
      runRecord = maybeRun;
    }

    return {
      runId,
      request: start.request,
      bufferedMessages: this.coordinator.getBufferedMessages(runId),
      reasoningSummaries: this.coordinator.getBufferedReasoning(runId),
      refusals: this.coordinator.getBufferedRefusals(runId),
      historyPlan: start.historyPlan,
      traceId: runRecord?.traceId,
      safety: runRecord?.safety ? serializeSafety(runRecord.safety) : undefined,
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

function ensureSafetyHash(value: string): string {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function serializeSafety(safety: SafetySnapshot): SerializedSafetySnapshot {
  return {
    hashedIdentifier: safety.hashedIdentifier,
    refusalCount: safety.refusalCount,
    lastRefusalAt: safety.lastRefusalAt ? safety.lastRefusalAt.toISOString() : undefined,
    moderatorNotes: safety.moderatorNotes.map((note) => ({
      reviewer: note.reviewer,
      note: note.note,
      disposition: note.disposition,
      recordedAt: note.recordedAt.toISOString(),
    })),
  };
}
