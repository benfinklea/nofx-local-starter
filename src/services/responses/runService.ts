import crypto from 'node:crypto';
import type { ResponsesRequest } from '../../shared/openai/responsesSchemas';
import { ResponsesRunCoordinator, type SpeechOptions } from './runCoordinator';
import type { DelegationRecord } from '../../shared/responses/archive';
import type { ToolRequestConfig } from './toolRegistry';
import type { HistoryPlanInput, HistoryPlanner } from './historyPlanner';
import type { ConversationPolicy } from './conversationStateManager';
import type { SafetySnapshot, RunRecord } from '../../shared/responses/archive';
import { sanitizeMetadata } from './sanitize';

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
  speech?: SpeechOptions;
}

export interface ResponsesRunResult {
  runId: string;
  request: ResponsesRequest;
  bufferedMessages: { id: string; text: string }[];
  reasoningSummaries: string[];
  refusals: string[];
  outputAudio: StreamingAudioSegment[];
  outputImages: StreamingImageArtifact[];
  inputTranscripts: InputAudioTranscript[];
  delegations: DelegationRecord[];
  historyPlan?: ReturnType<HistoryPlanner['plan']>;
  traceId?: string;
  safety?: SerializedSafetySnapshot;
}

export interface StreamingAudioSegment {
  itemId: string;
  audioBase64?: string;
  format?: string;
  transcript?: string;
}

export interface StreamingImageArtifact {
  itemId: string;
  b64JSON?: string;
  imageUrl?: string;
  background?: string | null;
  size?: string;
  createdAt?: string;
}

export interface InputAudioTranscript {
  itemId: string;
  transcript: string;
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

    const rawMetadata: Record<string, string> = {
      ...(typeof normalizedRequest.metadata === 'object' ? (normalizedRequest.metadata as Record<string, string>) : {}),
      ...(config.metadata ?? {}),
      tenant_id: config.tenantId,
      tenantId: config.tenantId,
    };
    if (hashedSafetyIdentifier) {
      rawMetadata.safety_identifier_hash = hashedSafetyIdentifier;
    }
    const region = resolveTenantRegion(config.tenantId);
    if (region) {
      rawMetadata.region = region;
    }
    const { metadata: sanitizedMetadata, redactedKeys } = sanitizeMetadata(rawMetadata);
    if (redactedKeys.length) {
      sanitizedMetadata.redacted_fields = redactedKeys.join(',');
    }

    normalizedRequest.metadata = sanitizedMetadata;

    const start = await this.coordinator.startRun({
      runId,
      tenantId: config.tenantId,
      request: {
        ...normalizedRequest,
        metadata: sanitizedMetadata,
      },
      metadata: sanitizedMetadata,
      tools: config.tools,
      history: config.history,
      policy: config.conversationPolicy,
      maxToolCalls: config.maxToolCalls,
      toolChoice: config.toolChoice,
      background: config.background,
      safety: hashedSafetyIdentifier ? { hashedIdentifier: hashedSafetyIdentifier } : undefined,
      speech: config.speech,
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
      outputAudio: this.coordinator.getBufferedOutputAudio(runId),
      outputImages: this.coordinator.getBufferedImages(runId),
      inputTranscripts: this.coordinator.getBufferedInputTranscripts(runId),
      delegations: this.coordinator.getDelegations(runId),
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

function resolveTenantRegion(tenantId: string | undefined): string | undefined {
  if (!tenantId) return undefined;
  if (!tenantRegionCache || tenantRegionEnvSnapshot !== (process.env.RESPONSES_TENANT_REGIONS || '')) {
    tenantRegionCache = buildTenantRegionMap(process.env.RESPONSES_TENANT_REGIONS);
    tenantRegionEnvSnapshot = process.env.RESPONSES_TENANT_REGIONS || '';
  }
  return tenantRegionCache.get(tenantId);
}

function buildTenantRegionMap(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [tenant, region] = pair.split(':').map((value) => value.trim());
      if (tenant && region) {
        map.set(tenant, region);
      }
    });
  return map;
}

let tenantRegionEnvSnapshot = process.env.RESPONSES_TENANT_REGIONS || '';
let tenantRegionCache: Map<string, string> = buildTenantRegionMap(process.env.RESPONSES_TENANT_REGIONS);
