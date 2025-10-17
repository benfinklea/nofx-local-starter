import { RateLimitTracker } from '../../src/services/responses/rateLimitTracker';

describe('RateLimitTracker', () => {
  it('parses headers into a snapshot and remembers the last one', () => {
    const tracker = new RateLimitTracker();
    const snapshot = tracker.capture({
      'x-ratelimit-limit-requests': '3000',
      'x-ratelimit-remaining-requests': '2999',
      'x-ratelimit-reset-requests': '30',
      'x-ratelimit-limit-tokens': '600000',
      'x-ratelimit-remaining-tokens': '599000',
      'x-ratelimit-reset-tokens': '30',
      'openai-processing-ms': '123',
      'x-request-id': 'req_123',
    }, { tenantId: 'tenant-a' });

    expect(snapshot.limitRequests).toBe(3000);
    expect(snapshot.remainingTokens).toBe(599000);
    expect(snapshot.processingMs).toBe(123);
    expect(tracker.getLastSnapshot()).toEqual(snapshot);
    expect(tracker.getLastSnapshot('tenant-a')).toEqual(snapshot);
  });

  it('summarises per-tenant history and alerts when thresholds breached', () => {
    const tracker = new RateLimitTracker();
    tracker.capture({
      'x-ratelimit-limit-requests': '1000',
      'x-ratelimit-remaining-requests': '900',
      'x-ratelimit-limit-tokens': '100000',
      'x-ratelimit-remaining-tokens': '95000',
    }, { tenantId: 'tenant-a' });
    tracker.capture({
      'x-ratelimit-limit-requests': '1000',
      'x-ratelimit-remaining-requests': '50',
      'x-ratelimit-limit-tokens': '100000',
      'x-ratelimit-remaining-tokens': '8000',
    }, { tenantId: 'tenant-a' });

    const [summary] = tracker.getTenantSummaries();
    expect(summary).toBeDefined();
    expect(summary!.tenantId).toBe('tenant-a');
    expect(summary!.latest?.remainingRequests).toBe(50);
    expect(summary!.alert).toBe('requests');
  });
});
