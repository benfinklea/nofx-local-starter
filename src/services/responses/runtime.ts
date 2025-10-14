import path from 'node:path';
import crypto from 'node:crypto';
import { ResponsesRunCoordinator } from './runCoordinator';
import { ResponsesRunService, type ResponsesRunResult } from './runService';
import { FileSystemResponsesArchive } from './archiveStore';
import { ConversationStateManager, InMemoryConversationStore } from './conversationStateManager';
import { RateLimitTracker } from './rateLimitTracker';
import { ToolRegistry } from './toolRegistry';
import { HistoryPlanner } from './historyPlanner';
import type { ResponsesClient } from './runCoordinator';
import type { ResponsesResult } from '../../shared/openai/responsesSchemas';
import { OpenAIResponsesClient } from './openaiClient';
import { IncidentLog, type IncidentStatus } from './incidentLog';
import type { ModeratorNote, ModeratorDisposition, RollbackOptions } from '../../shared/responses/archive';
import { DelegationTracker } from './delegationTracker';

// Import extracted services
import { RuntimeSummaryService } from './runtime/RuntimeSummaryService';
import { RuntimeDataService } from './runtime/RuntimeDataService';
import { RuntimeRetryService } from './runtime/RuntimeRetryService';
import { RuntimeIncidentService } from './runtime/RuntimeIncidentService';
import { RuntimeUtilityService } from './runtime/RuntimeUtilityService';

// Re-export types from services
export type { ResponsesOperationsSummary } from './runtime/RuntimeSummaryService';
export type { SerializedIncident } from './runtime/RuntimeIncidentService';

export type RuntimeBundle = {
  archive: FileSystemResponsesArchive;
  coordinator: ResponsesRunCoordinator;
  service: ResponsesRunService;
  tracker: RateLimitTracker;
  toolRegistry: ToolRegistry;
  incidents: IncidentLog;
  delegations: DelegationTracker;
};

type RuntimeServices = {
  summary: RuntimeSummaryService;
  data: RuntimeDataService;
  retry: RuntimeRetryService;
  incident: RuntimeIncidentService;
  utility: RuntimeUtilityService;
};

let bundle: RuntimeBundle | undefined;
let services: RuntimeServices | undefined;

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

export function getResponsesRuntime(): RuntimeBundle {
  if (!bundle) {
    bundle = createRuntime();
  }
  return bundle;
}

function getServices(): RuntimeServices {
  if (!services) {
    const runtime = getResponsesRuntime();
    services = {
      summary: new RuntimeSummaryService(runtime),
      data: new RuntimeDataService(runtime),
      retry: new RuntimeRetryService(runtime),
      incident: new RuntimeIncidentService(runtime),
      utility: new RuntimeUtilityService(runtime),
    };
  }
  return services;
}

export function resetResponsesRuntime() {
  bundle = undefined;
  services = undefined;
}

// Delegated function exports
export function getResponsesOperationsSummary() {
  return getServices().summary.generateOperationsSummary();
}

export function pruneResponsesOlderThanDays(days: number): void {
  getServices().data.pruneOlderThanDays(days);
}

export function retryResponsesRun(originalRunId: string, options?: { tenantId?: string; metadata?: Record<string, string>; background?: boolean }): Promise<ResponsesRunResult> {
  return getServices().retry.retryResponsesRun(originalRunId, options);
}

export function listResponseIncidents(status: IncidentStatus = 'open') {
  return getServices().incident.listResponseIncidents(status);
}

export function resolveResponseIncident(input: { incidentId: string; resolvedBy: string; notes?: string; disposition?: string; linkedRunId?: string }) {
  return getServices().incident.resolveResponseIncident(input);
}

export function addResponsesModeratorNote(runId: string, note: { reviewer: string; note: string; disposition: ModeratorDisposition; recordedAt?: Date }): ModeratorNote {
  return getServices().utility.addResponsesModeratorNote(runId, note);
}

export async function exportResponsesRun(runId: string): Promise<string> {
  return getServices().utility.exportResponsesRun(runId);
}

export function getRunIncidents(runId: string) {
  return getServices().incident.getRunIncidents(runId);
}

export async function rollbackResponsesRun(runId: string, options: RollbackOptions) {
  return getServices().utility.rollbackResponsesRun(runId, options);
}