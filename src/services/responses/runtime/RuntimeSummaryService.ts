/**
 * Runtime Summary Service - extracted from runtime.ts
 * Handles operations summary generation and analytics
 */

import type { RuntimeBundle } from '../runtime';
import type { RateLimitTenantSummary, RateLimitSnapshot } from '../rateLimitTracker';
import type { IncidentRecord } from '../incidentLog';
import type { RunRecord } from '../../../shared/responses/archive';

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

export class RuntimeSummaryService {
  constructor(private runtime: RuntimeBundle) {}

  generateOperationsSummary(): ResponsesOperationsSummary {
    const runs = this.runtime.archive.listRuns();
    const statusCounts = this.calculateStatusCounts(runs);
    const timeBasedMetrics = this.calculateTimeBasedMetrics(runs);
    const tokenMetrics = this.calculateTokenMetrics(runs);
    const tenantRollup = this.generateTenantRollup(runs);
    const recentRuns = this.getRecentRuns(runs);
    const incidentData = this.getIncidentData();
    const rateLimitData = this.getRateLimitData();

    return {
      totalRuns: runs.length,
      statusCounts,
      failuresLast24h: timeBasedMetrics.failuresLast24h,
      lastRunAt: timeBasedMetrics.lastRunAt,
      totalTokens: tokenMetrics.total,
      averageTokensPerRun: runs.length ? tokenMetrics.total / runs.length : 0,
      totalEstimatedCost: tokenMetrics.estimatedCost,
      recentRuns,
      totalRefusals: tokenMetrics.totalRefusals,
      lastRateLimits: rateLimitData.lastSnapshot,
      rateLimitTenants: rateLimitData.tenantSummaries,
      tenantRollup: tenantRollup.sort((a, b) => b.totalTokens - a.totalTokens),
      openIncidents: incidentData.count,
      incidentDetails: incidentData.details,
    };
  }

  private calculateStatusCounts(runs: RunRecord[]): Record<string, number> {
    const statusCounts: Record<string, number> = {};

    for (const run of runs) {
      const status = run.status ?? 'unknown';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    return statusCounts;
  }

  private calculateTimeBasedMetrics(runs: RunRecord[]) {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    let failuresLast24h = 0;
    let lastRunAt: Date | undefined;

    for (const run of runs) {
      if (!lastRunAt || run.updatedAt > lastRunAt) {
        lastRunAt = run.updatedAt;
      }

      const status = run.status ?? 'unknown';
      if (run.updatedAt.getTime() >= dayAgo && (status === 'failed' || status === 'incomplete')) {
        failuresLast24h += 1;
      }
    }

    return {
      failuresLast24h,
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : undefined,
    };
  }

  private calculateTokenMetrics(runs: RunRecord[]) {
    let totalTokens = 0;
    let totalRefusals = 0;
    const costPerThousand = Number(process.env.RESPONSES_COST_PER_1K_TOKENS || 0.002);
    let totalEstimatedCost = 0;

    for (const run of runs) {
      const tokens = run.result?.usage?.total_tokens ?? 0;
      totalTokens += tokens;

      const runCost = (tokens / 1000) * costPerThousand;
      totalEstimatedCost += runCost;

      const refusals = run.safety?.refusalCount ?? 0;
      totalRefusals += refusals;
    }

    return {
      total: totalTokens,
      totalRefusals,
      estimatedCost: Number(totalEstimatedCost.toFixed(6)),
    };
  }

  private generateTenantRollup(runs: RunRecord[]): TenantRollup[] {
    const tenantRollupMap = new Map<string, {
      runs: number;
      tokens: number;
      refusals: number;
      lastRunAt?: Date;
      cost: number;
      regions: Set<string>
    }>();

    const costPerThousand = Number(process.env.RESPONSES_COST_PER_1K_TOKENS || 0.002);

    for (const run of runs) {
      const tokens = run.result?.usage?.total_tokens ?? 0;
      const runCost = (tokens / 1000) * costPerThousand;
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
    }

    return Array.from(tenantRollupMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      runCount: data.runs,
      totalTokens: data.tokens,
      averageTokensPerRun: data.runs ? data.tokens / data.runs : 0,
      refusalCount: data.refusals,
      lastRunAt: data.lastRunAt ? data.lastRunAt.toISOString() : undefined,
      estimatedCost: Number(data.cost.toFixed(6)),
      regions: Array.from(data.regions.values()),
    }));
  }

  private getRecentRuns(runs: RunRecord[]) {
    return runs.slice(0, 10).map((run) => ({
      runId: run.runId,
      status: run.status,
      model: run.request?.model,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      traceId: run.traceId,
      tenantId: run.metadata?.tenant_id ?? run.metadata?.tenantId,
      refusalCount: run.safety?.refusalCount,
    }));
  }

  private getIncidentData() {
    const incidents = this.runtime.incidents.listIncidents({ status: 'open' });
    return {
      count: incidents.length,
      details: incidents.map(this.serializeIncident),
    };
  }

  private getRateLimitData() {
    const tenantSummaries = this.runtime.tracker.getTenantSummaries().map(this.serializeTenantSummary);
    const lastSnapshot = this.runtime.tracker.getLastSnapshot();

    return {
      tenantSummaries,
      lastSnapshot: lastSnapshot ? this.serializeSnapshot(lastSnapshot) : undefined,
    };
  }

  private serializeIncident(record: IncidentRecord): SerializedIncident {
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

  private serializeTenantSummary(summary: RateLimitTenantSummary): SerializedTenantRateLimit {
    return {
      tenantId: summary.tenantId,
      latest: summary.latest ? this.serializeSnapshot(summary.latest) : undefined,
      averageProcessingMs: summary.averageProcessingMs,
      remainingRequestsPct: summary.remainingRequestsPct,
      remainingTokensPct: summary.remainingTokensPct,
      alert: summary.alert,
    };
  }

  private serializeSnapshot(snapshot: RateLimitSnapshot): SerializedRateLimitSnapshot {
    return {
      ...snapshot,
      observedAt: snapshot.observedAt.toISOString(),
    };
  }
}