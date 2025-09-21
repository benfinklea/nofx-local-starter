import path from 'node:path';
import crypto from 'node:crypto';
import { ResponsesRunCoordinator } from './runCoordinator';
import { ResponsesRunService, type ResponsesRunConfig, type ResponsesRunResult } from './runService';
import { FileSystemResponsesArchive } from './archiveStore';
import { ConversationStateManager, InMemoryConversationStore } from './conversationStateManager';
import { RateLimitTracker } from './rateLimitTracker';
import { ToolRegistry } from './toolRegistry';
import { HistoryPlanner } from './historyPlanner';
import type { ResponsesClient } from './runCoordinator';
import type { ResponsesResult } from '../../shared/openai/responsesSchemas';
import { OpenAIResponsesClient } from './openaiClient';
import { IncidentLog, type IncidentRecord, type IncidentStatus, type IncidentDisposition } from './incidentLog';
import type { RateLimitTenantSummary, RateLimitSnapshot } from './rateLimitTracker';
import type { ModeratorNote, ModeratorDisposition, RollbackOptions, RunRecord, EventRecord } from '../../shared/responses/archive';
import { DelegationTracker } from './delegationTracker';

type RuntimeBundle = {
  archive: FileSystemResponsesArchive;
  coordinator: ResponsesRunCoordinator;
  service: ResponsesRunService;
  tracker: RateLimitTracker;
  toolRegistry: ToolRegistry;
  incidents: IncidentLog;
  delegations: DelegationTracker;
};

export interface ResponsesOperationsSummary {
  totalRuns: number;
  statusCounts: Record<string, number>;
  failuresLast24h: number;
  lastRunAt?: string;
  totalTokens: number;
  averageTokensPerRun: number;
  totalEstimatedCost: number;
  recentRuns: Array<{
    runId: string;
    status: string;
    model?: string;
    createdAt: string;
    updatedAt: string;
    traceId?: string;
    tenantId?: string;
    refusalCount?: number;
  }>;
  totalRefusals: number;
  lastRateLimits?: SerializedRateLimitSnapshot;
  rateLimitTenants: SerializedTenantRateLimit[];
  tenantRollup: TenantRollup[];
  openIncidents: number;
  incidentDetails: SerializedIncident[];
}

type SerializedRateLimitSnapshot = (Omit<RateLimitSnapshot, 'observedAt'> & { observedAt: string }) | undefined;

type SerializedTenantRateLimit = {
  tenantId: string;
  latest?: SerializedRateLimitSnapshot;
  averageProcessingMs?: number;
  remainingRequestsPct?: number;
  remainingTokensPct?: number;
  alert?: 'requests' | 'tokens';
};

type TenantRollup = {
  tenantId: string;
  runCount: number;
  totalTokens: number;
  averageTokensPerRun: number;
  refusalCount: number;
  lastRunAt?: string;
  estimatedCost: number;
  regions: string[];
};

type SerializedIncident = {
  id: string;
  runId: string;
  status: string;
  type: string;
  sequence: number;
  occurredAt: string;
  tenantId?: string;
  model?: string;
  requestId?: string;
  traceId?: string;
  reason?: string;
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    notes?: string;
    disposition: string;
    linkedRunId?: string;
  };
};

let bundle: RuntimeBundle | undefined;

class StubResponsesClient implements ResponsesClient {
  async create(): Promise<{ result: ResponsesResult; headers?: Record<string, string> }> {
    const text = 'This is a stubbed Responses run output. Set RESPONSES_RUNTIME_MODE=stub to use real provider tests.';
    const result: ResponsesResult = {
      id: `resp_${crypto.randomUUID()}`,
      status: 'completed',
      output: [
        {
          type: 'message',
          id: `msg_${crypto.randomUUID()}`,
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text,
            },
          ],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
      model: 'stub-model',
    };
    return {
      result,
      headers: {
        'x-ratelimit-limit-requests': '1000',
        'x-ratelimit-remaining-requests': '999',
      },
    };
  }
}

function createClient(): ResponsesClient {
  if ((process.env.RESPONSES_RUNTIME_MODE || '').toLowerCase() === 'stub') {
    return new StubResponsesClient();
  }
  return new OpenAIResponsesClient();
}

function createRuntime(): RuntimeBundle {
  const archiveDir = process.env.RESPONSES_ARCHIVE_DIR
    ? path.resolve(process.env.RESPONSES_ARCHIVE_DIR)
    : path.join(process.cwd(), 'local_data', 'responses');

  const archive = new FileSystemResponsesArchive(archiveDir, {
    coldStorageDir: process.env.RESPONSES_ARCHIVE_COLD_STORAGE_DIR,
    exportDir: process.env.RESPONSES_ARCHIVE_EXPORT_DIR,
  });
  const conversationStore = new InMemoryConversationStore();
  const defaultPolicy = (process.env.RESPONSES_DEFAULT_POLICY || '').toLowerCase() === 'vendor'
    ? { strategy: 'vendor' as const }
    : { strategy: 'stateless' as const };
  const conversationManager = new ConversationStateManager(conversationStore, defaultPolicy);
  const tracker = new RateLimitTracker();
  const toolRegistry = new ToolRegistry();
  const historyPlanner = new HistoryPlanner({
    contextWindowTokens: Number(process.env.RESPONSES_CONTEXT_WINDOW_TOKENS || 128000),
  });
  const incidentLog = new IncidentLog(archiveDir);
  const delegationTracker = new DelegationTracker({ archive });

  const ttlEnv = Number(process.env.RESPONSES_ARCHIVE_TTL_DAYS || 0);
  if (ttlEnv > 0 && typeof archive.pruneOlderThan === 'function') {
    const cutoff = new Date(Date.now() - ttlEnv * 24 * 60 * 60 * 1000);
    archive.pruneOlderThan(cutoff);
  }

  const coordinator = new ResponsesRunCoordinator({
    archive,
    conversationManager,
    client: createClient(),
    rateLimitTracker: tracker,
    toolRegistry,
    historyPlanner,
    incidentLog,
    delegationTracker,
  });
  const service = new ResponsesRunService(coordinator);

  return { archive, coordinator, service, tracker, toolRegistry, incidents: incidentLog, delegations: delegationTracker };
}

function serializeRunRecordMinimal(run: RunRecord) {
  return {
    runId: run.runId,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    model: run.request?.model,
    metadata: run.metadata ?? {},
    traceId: run.traceId,
  };
}

function serializeEventRecordMinimal(event: EventRecord) {
  return {
    sequence: event.sequence,
    type: event.type,
    payload: event.payload,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export function getResponsesRuntime(): RuntimeBundle {
  if (!bundle) {
    bundle = createRuntime();
  }
  return bundle;
}

export function resetResponsesRuntime() {
  bundle = undefined;
}

export function getResponsesOperationsSummary(): ResponsesOperationsSummary {
  const runtime = getResponsesRuntime();
  const runs = runtime.archive.listRuns();
  const statusCounts: Record<string, number> = {};
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  let failuresLast24h = 0;
  let totalTokens = 0;
  let lastRunAt: Date | undefined;
  let totalRefusals = 0;

  const tenantRollupMap = new Map<string, { runs: number; tokens: number; refusals: number; lastRunAt?: Date; cost: number; regions: Set<string> }>();
  const costPerThousand = Number(process.env.RESPONSES_COST_PER_1K_TOKENS || 0.002);
  let totalEstimatedCost = 0;

  for (const run of runs) {
    const status = run.status ?? 'unknown';
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (!lastRunAt || run.updatedAt > lastRunAt) {
      lastRunAt = run.updatedAt;
    }
    if (run.updatedAt.getTime() >= dayAgo && (status === 'failed' || status === 'incomplete')) {
      failuresLast24h += 1;
    }
    const tokens = run.result?.usage?.total_tokens ?? 0;
    totalTokens += tokens;
    const runCost = (tokens / 1000) * costPerThousand;
    totalEstimatedCost += runCost;
    const tenantId = run.metadata?.tenant_id ?? run.metadata?.tenantId ?? 'default';
    const current = tenantRollupMap.get(tenantId) ?? {
      runs: 0,
      tokens: 0,
      refusals: 0,
      cost: 0,
      regions: new Set<string>(),
    };
    current.runs += 1;
    current.tokens += tokens;
    if (!current.lastRunAt || run.updatedAt > current.lastRunAt) {
      current.lastRunAt = run.updatedAt;
    }
    const refusals = run.safety?.refusalCount ?? 0;
    current.refusals += refusals;
    current.cost += runCost;
    const region = run.metadata?.region;
    if (region) current.regions.add(region);
    tenantRollupMap.set(tenantId, current);
    totalRefusals += refusals;
  }

  const recentRuns = runs.slice(0, 10).map((run) => ({
    runId: run.runId,
    status: run.status,
    model: run.request?.model,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    traceId: run.traceId,
    tenantId: run.metadata?.tenant_id ?? run.metadata?.tenantId,
    refusalCount: run.safety?.refusalCount,
  }));

  const tenantRollup: TenantRollup[] = Array.from(tenantRollupMap.entries()).map(([tenantId, data]) => ({
    tenantId,
    runCount: data.runs,
    totalTokens: data.tokens,
    averageTokensPerRun: data.runs ? data.tokens / data.runs : 0,
    refusalCount: data.refusals,
    lastRunAt: data.lastRunAt ? data.lastRunAt.toISOString() : undefined,
    estimatedCost: Number(data.cost.toFixed(6)),
    regions: Array.from(data.regions.values()),
  }));

  const openIncidents = runtime.incidents.listIncidents({ status: 'open' }).map(serializeIncident);
  const rateLimitSummaries = runtime.tracker.getTenantSummaries().map(serializeTenantSummary);
  const lastRateSnapshot = runtime.tracker.getLastSnapshot();

  return {
    totalRuns: runs.length,
    statusCounts,
    failuresLast24h,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : undefined,
    totalTokens,
    averageTokensPerRun: runs.length ? totalTokens / runs.length : 0,
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(6)),
    recentRuns,
    totalRefusals,
    lastRateLimits: lastRateSnapshot ? serializeSnapshot(lastRateSnapshot) : undefined,
    rateLimitTenants: rateLimitSummaries,
    tenantRollup: tenantRollup.sort((a, b) => b.totalTokens - a.totalTokens),
    openIncidents: openIncidents.length,
    incidentDetails: openIncidents,
  };
}

export function pruneResponsesOlderThanDays(days: number): void {
  if (days <= 0) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const runtime = getResponsesRuntime();
  if (typeof runtime.archive.pruneOlderThan === 'function') {
    runtime.archive.pruneOlderThan(cutoff);
    return;
  }
  const runs = runtime.archive.listRuns();
  if (typeof runtime.archive.deleteRun === 'function') {
    for (const run of runs) {
      if (run.updatedAt < cutoff) runtime.archive.deleteRun(run.runId);
    }
  }
}

export function retryResponsesRun(originalRunId: string, options?: { tenantId?: string; metadata?: Record<string, string>; background?: boolean }): Promise<ResponsesRunResult> {
  const runtime = getResponsesRuntime();
  const original = runtime.archive.getRun(originalRunId);
  if (!original) throw new Error('run not found');
  const tenantId = options?.tenantId ?? original.metadata?.tenant_id ?? original.metadata?.tenantId ?? 'default';
  const retryMetadata: Record<string, string> = {
    ...(original.metadata ?? {}),
    ...(options?.metadata ?? {}),
    retried_from: originalRunId,
  };
  const input = original.request.input;
  if (input === undefined) {
    throw new Error('original run is missing input payload');
  }
  const request: ResponsesRunConfig['request'] = {
    ...original.request,
    input,
    metadata: {
      ...(original.request.metadata ?? {}),
      retried_from: originalRunId,
    },
  };

  return runtime.service.execute({
    tenantId,
    request,
    metadata: retryMetadata,
    history: undefined,
    conversationPolicy: { strategy: 'stateless' },
    background: options?.background ?? false,
  }).then((result) => {
    runtime.incidents.resolveIncidentsByRun(originalRunId, {
      resolvedBy: 'system',
      disposition: 'retry',
      linkedRunId: result.runId,
    });
    return result;
  });
}

export function listResponseIncidents(status: IncidentStatus = 'open'): SerializedIncident[] {
  const runtime = getResponsesRuntime();
  return runtime.incidents.listIncidents({ status }).map(serializeIncident);
}

export function resolveResponseIncident(input: { incidentId: string; resolvedBy: string; notes?: string; disposition?: string; linkedRunId?: string }): SerializedIncident {
  const runtime = getResponsesRuntime();
  const record = runtime.incidents.resolveIncident({
    incidentId: input.incidentId,
    resolvedBy: input.resolvedBy,
    notes: input.notes,
    disposition: (input.disposition as IncidentDisposition | undefined) ?? 'manual',
    linkedRunId: input.linkedRunId,
  });
  return serializeIncident(record);
}

export function addResponsesModeratorNote(runId: string, note: { reviewer: string; note: string; disposition: ModeratorDisposition; recordedAt?: Date }): ModeratorNote {
  const runtime = getResponsesRuntime();
  const created = runtime.archive.addModeratorNote?.(runId, note);
  if (!created) throw new Error('archive does not support moderator notes');
  return created;
}

export async function exportResponsesRun(runId: string): Promise<string> {
  const runtime = getResponsesRuntime();
  if (!runtime.archive.exportRun) throw new Error('archive export not supported');
  return runtime.archive.exportRun(runId);
}

export function getRunIncidents(runId: string): SerializedIncident[] {
  const runtime = getResponsesRuntime();
  return runtime.incidents.getIncidentsForRun(runId).map(serializeIncident);
}

export async function rollbackResponsesRun(runId: string, options: RollbackOptions) {
  const runtime = getResponsesRuntime();
  if (typeof runtime.archive.rollback !== 'function') {
    throw new Error('archive does not support rollback operations');
  }
  const snapshot = runtime.archive.rollback(runId, options);
  const maybePromise = runtime.coordinator.resyncFromArchive(runId);
  if (maybePromise instanceof Promise) {
    await maybePromise;
  }
  return {
    run: serializeRunRecordMinimal(snapshot.run),
    events: snapshot.events.map(serializeEventRecordMinimal),
  };
}

function serializeSnapshot(snapshot: RateLimitSnapshot): SerializedRateLimitSnapshot {
  return {
    ...snapshot,
    observedAt: snapshot.observedAt.toISOString(),
  };
}

function serializeTenantSummary(summary: RateLimitTenantSummary): SerializedTenantRateLimit {
  return {
    tenantId: summary.tenantId,
    latest: summary.latest ? serializeSnapshot(summary.latest) : undefined,
    averageProcessingMs: summary.averageProcessingMs,
    remainingRequestsPct: summary.remainingRequestsPct,
    remainingTokensPct: summary.remainingTokensPct,
    alert: summary.alert,
  };
}

function serializeIncident(record: IncidentRecord): SerializedIncident {
  return {
    id: record.id,
    runId: record.runId,
    status: record.status,
    type: record.type,
    sequence: record.sequence,
    occurredAt: record.occurredAt.toISOString(),
    tenantId: record.tenantId,
    model: record.model,
    requestId: record.requestId,
    traceId: record.traceId,
    reason: record.reason,
    resolution: record.resolution
      ? {
          resolvedAt: record.resolution.resolvedAt.toISOString(),
          resolvedBy: record.resolution.resolvedBy,
          notes: record.resolution.notes,
          disposition: record.resolution.disposition,
          linkedRunId: record.resolution.linkedRunId,
        }
      : undefined,
  };
}
