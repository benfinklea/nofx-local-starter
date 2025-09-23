import { apiBase } from '../config';

function withBase(path: string): string {
  return apiBase ? `${apiBase}${path}` : path;
}

export interface ResponsesRunSummary {
  runId: string;
  status: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  traceId?: string;
  metadata: Record<string, string>;
  safety?: {
    hashedIdentifier?: string;
    refusalCount: number;
    lastRefusalAt?: string;
    moderatorNotes: ModeratorNote[];
  };
  tenantId?: string;
}

export interface ResponsesEventRecord {
  sequence: number;
  type: string;
  payload: unknown;
  occurredAt: string;
}

export interface ModeratorNote {
  reviewer: string;
  note: string;
  disposition: string;
  recordedAt: string;
}

export interface DelegationRecord {
  callId: string;
  toolName: string;
  status: 'requested' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
  output?: unknown;
}

export interface IncidentRecord {
  id: string;
  status: string;
  type: string;
  occurredAt: string;
  disposition?: string;
  resolvedAt?: string;
}

export interface ResponsesRunDetail {
  run: ResponsesRunSummary;
  events: ResponsesEventRecord[];
  bufferedMessages: Array<{ id: string; text: string }>;
  reasoning: string[];
  refusals: string[];
  outputAudio: Array<{ itemId: string; audioBase64?: string; format?: string; transcript?: string }>;
  outputImages: Array<{ itemId: string; b64JSON?: string; imageUrl?: string; background?: string | null; size?: string; createdAt?: string }>;
  inputTranscripts: Array<{ itemId: string; transcript: string }>;
  delegations: DelegationRecord[];
  incidents: IncidentRecord[];
}

export interface ResponsesOperationsSummary {
  totalRuns: number;
  statusCounts: Record<string, number>;
  failuresLast24h: number;
  lastRunAt?: string;
  totalEstimatedCost: number;
  totalTokens: number;
  averageTokensPerRun: number;
  totalRefusals: number;
  lastRateLimits?: RateLimitSnapshot;
  recentRuns: Array<Pick<ResponsesRunSummary, 'runId' | 'status' | 'model' | 'createdAt' | 'updatedAt' | 'traceId' | 'tenantId'> & { refusalCount?: number }>;
  rateLimitTenants: TenantRateLimitSummary[];
  tenantRollup: Array<{ tenantId: string; runCount: number; estimatedCost: number; regions: string[]; refusalCount: number; totalTokens: number; averageTokensPerRun: number; lastRunAt?: string }>;
  openIncidents: number;
  incidentDetails: IncidentSummary[];
}

export interface RateLimitSnapshot {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsSeconds?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensSeconds?: number;
  processingMs?: number;
  requestId?: string;
  tenantId?: string;
  observedAt: string;
}

export interface TenantRateLimitSummary {
  tenantId: string;
  latest?: RateLimitSnapshot;
  averageProcessingMs?: number;
  remainingRequestsPct?: number;
  remainingTokensPct?: number;
  alert?: 'requests' | 'tokens';
}

export interface IncidentSummary {
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
}

export async function listResponsesRuns(): Promise<ResponsesRunSummary[]> {
  const rsp = await fetch(withBase('/responses/runs'), { credentials: 'include' });
  if (!rsp.ok) throw new Error(`failed to fetch responses runs (${rsp.status})`);
  const json = await rsp.json();
  return Array.isArray(json?.runs) ? json.runs : [];
}

export async function getResponsesSummary(): Promise<ResponsesOperationsSummary | null> {
  const rsp = await fetch(withBase('/responses/ops/summary'), { credentials: 'include' });
  if (!rsp.ok) {
    console.warn('[ResponsesAPI] summary request failed', rsp.status);
    return null;
  }
  return rsp.json();
}

export async function getResponsesRun(id: string): Promise<ResponsesRunDetail> {
  const rsp = await fetch(withBase(`/responses/runs/${encodeURIComponent(id)}`), { credentials: 'include' });
  if (!rsp.ok) throw new Error(`run ${id} not found`);
  return rsp.json();
}

export async function retryResponsesRun(id: string): Promise<{ runId: string }> {
  const rsp = await fetch(withBase(`/responses/runs/${encodeURIComponent(id)}/retry`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ background: true }),
  });
  if (!rsp.ok) throw new Error(`retry failed (${rsp.status})`);
  return rsp.json();
}

export async function addModeratorNote(id: string, input: { reviewer: string; note: string; disposition: string }) {
  const rsp = await fetch(withBase(`/responses/runs/${encodeURIComponent(id)}/moderation-notes`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!rsp.ok) throw new Error('failed to record note');
  return rsp.json();
}

export async function logUiEvent(event: { source: string; intent: string; metadata?: Record<string, unknown> }) {
  try {
    await fetch(withBase('/responses/ops/ui-event'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn('[ResponsesUI] failed to log UI event', err);
  }
}
