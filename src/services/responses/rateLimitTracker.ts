export type RateLimitSnapshot = {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsSeconds?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensSeconds?: number;
  processingMs?: number;
  requestId?: string;
  tenantId?: string;
  observedAt: Date;
};

export type RateLimitTenantSummary = {
  tenantId: string;
  latest?: RateLimitSnapshot;
  averageProcessingMs?: number;
  remainingRequestsPct?: number;
  remainingTokensPct?: number;
  alert?: 'requests' | 'tokens';
};

function parseIntHeader(value?: string): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

export class RateLimitTracker {
  private lastSnapshot: RateLimitSnapshot | undefined;

  private readonly tenantHistory = new Map<string, RateLimitSnapshot[]>();

  capture(headers: Record<string, string | undefined>, context: { tenantId?: string } = {}): RateLimitSnapshot {
    const snapshot: RateLimitSnapshot = {
      limitRequests: parseIntHeader(headers['x-ratelimit-limit-requests']),
      remainingRequests: parseIntHeader(headers['x-ratelimit-remaining-requests']),
      resetRequestsSeconds: parseIntHeader(headers['x-ratelimit-reset-requests']),
      limitTokens: parseIntHeader(headers['x-ratelimit-limit-tokens']),
      remainingTokens: parseIntHeader(headers['x-ratelimit-remaining-tokens']),
      resetTokensSeconds: parseIntHeader(headers['x-ratelimit-reset-tokens']),
      processingMs: parseIntHeader(headers['openai-processing-ms']),
      requestId: headers['x-request-id'],
      tenantId: context.tenantId,
      observedAt: new Date(),
    };
    this.lastSnapshot = snapshot;
    this.recordHistory(context.tenantId, snapshot);
    return snapshot;
  }

  getLastSnapshot(tenantId?: string): RateLimitSnapshot | undefined {
    if (tenantId) {
      const history = this.tenantHistory.get(tenantId);
      return history && history.length ? history[history.length - 1] : undefined;
    }
    return this.lastSnapshot;
  }

  getTenantSummaries(): RateLimitTenantSummary[] {
    const summaries: RateLimitTenantSummary[] = [];
    for (const [tenantId, history] of this.tenantHistory.entries()) {
      if (history.length === 0) {
        summaries.push({ tenantId, latest: undefined, averageProcessingMs: undefined });
        continue;
      }
      const latest = history[history.length - 1];
      const avgProcessingMs = history.reduce((sum, item) => sum + (item.processingMs ?? 0), 0) / history.length;
      const remainingRequestsPct =
        latest.limitRequests && latest.remainingRequests !== undefined
          ? latest.remainingRequests / latest.limitRequests
          : undefined;
      const remainingTokensPct =
        latest.limitTokens && latest.remainingTokens !== undefined ? latest.remainingTokens / latest.limitTokens : undefined;

      let alert: 'requests' | 'tokens' | undefined;
      if (remainingRequestsPct !== undefined && remainingRequestsPct <= 0.1) alert = 'requests';
      if (remainingTokensPct !== undefined && remainingTokensPct <= 0.1) alert = alert ?? 'tokens';

      summaries.push({
        tenantId,
        latest,
        averageProcessingMs: Number.isNaN(avgProcessingMs) ? undefined : avgProcessingMs,
        remainingRequestsPct,
        remainingTokensPct,
        alert,
      });
    }
    return summaries.sort((a, b) => (a.tenantId < b.tenantId ? -1 : 1));
  }

  private recordHistory(tenantId: string | undefined, snapshot: RateLimitSnapshot) {
    if (!tenantId) return;
    const history = this.tenantHistory.get(tenantId) ?? [];
    history.push(snapshot);
    while (history.length > 50) {
      history.shift();
    }
    this.tenantHistory.set(tenantId, history);
  }
}
