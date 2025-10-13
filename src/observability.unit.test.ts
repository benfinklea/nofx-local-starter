import { describe, it, expect, beforeAll, jest, beforeEach } from '@jest/globals';

// Set environment BEFORE any imports
process.env.QUEUE_DRIVER = 'memory';
process.env.DATA_DRIVER = 'fs';

// Mock IORedis to prevent it from being loaded even when not used
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(() => Promise.resolve('OK')),
    duplicate: jest.fn(function() {
      return {
        on: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        quit: jest.fn(() => Promise.resolve('OK'))
      };
    }),
    keyPrefix: ''
  }));
});

import { metrics } from './lib/metrics';
import { getCounts, STEP_READY_TOPIC } from './lib/queue';

describe('Observability & Queue basics', () => {
  beforeAll(async () => {
    // Environment already set above before imports
  });

  it('metrics.render returns a text payload', async () => {
    const body = await metrics.render();
    expect(typeof body).toBe('string');
    // It may be a placeholder if prom-client is missing
    expect(body.length).toBeGreaterThan(0);
  });

  it('queue getCounts returns expected keys', async () => {
    const c = await getCounts(STEP_READY_TOPIC);
    expect(c).toHaveProperty('waiting');
    expect(c).toHaveProperty('active');
    expect(c).toHaveProperty('failed');
  });
});
