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
    });

    expect(snapshot.limitRequests).toBe(3000);
    expect(snapshot.remainingTokens).toBe(599000);
    expect(snapshot.processingMs).toBe(123);
    expect(tracker.getLastSnapshot()).toEqual(snapshot);
  });
});
