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

type RuntimeBundle = {
  archive: FileSystemResponsesArchive;
  coordinator: ResponsesRunCoordinator;
  service: ResponsesRunService;
  tracker: RateLimitTracker;
  toolRegistry: ToolRegistry;
};

export interface ResponsesOperationsSummary {
  totalRuns: number;
  statusCounts: Record<string, number>;
  failuresLast24h: number;
  lastRunAt?: string;
  totalTokens: number;
  averageTokensPerRun: number;
  recentRuns: Array<{
    runId: string;
    status: string;
    model?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  lastRateLimits?: ReturnType<RateLimitTracker['getLastSnapshot']>;
}

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

  const archive = new FileSystemResponsesArchive(archiveDir);
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
  });
  const service = new ResponsesRunService(coordinator);

  return { archive, coordinator, service, tracker, toolRegistry };
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
  }

  const recentRuns = runs.slice(0, 10).map((run) => ({
    runId: run.runId,
    status: run.status,
    model: run.request?.model,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }));

  return {
    totalRuns: runs.length,
    statusCounts,
    failuresLast24h,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : undefined,
    totalTokens,
    averageTokensPerRun: runs.length ? totalTokens / runs.length : 0,
    recentRuns,
    lastRateLimits: runtime.tracker.getLastSnapshot(),
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
  });
}
