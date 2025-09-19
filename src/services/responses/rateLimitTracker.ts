export type RateLimitSnapshot = {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsSeconds?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensSeconds?: number;
  processingMs?: number;
  requestId?: string;
};

function parseIntHeader(value?: string): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

export class RateLimitTracker {
  private lastSnapshot: RateLimitSnapshot | undefined;

  capture(headers: Record<string, string | undefined>): RateLimitSnapshot {
    const snapshot: RateLimitSnapshot = {
      limitRequests: parseIntHeader(headers['x-ratelimit-limit-requests']),
      remainingRequests: parseIntHeader(headers['x-ratelimit-remaining-requests']),
      resetRequestsSeconds: parseIntHeader(headers['x-ratelimit-reset-requests']),
      limitTokens: parseIntHeader(headers['x-ratelimit-limit-tokens']),
      remainingTokens: parseIntHeader(headers['x-ratelimit-remaining-tokens']),
      resetTokensSeconds: parseIntHeader(headers['x-ratelimit-reset-tokens']),
      processingMs: parseIntHeader(headers['openai-processing-ms']),
      requestId: headers['x-request-id'],
    };
    this.lastSnapshot = snapshot;
    return snapshot;
  }

  getLastSnapshot(): RateLimitSnapshot | undefined {
    return this.lastSnapshot;
  }
}
