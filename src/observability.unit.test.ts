import { describe, it, expect, beforeAll } from '@jest/globals';
import { metrics } from './lib/metrics';
import { getCounts, STEP_READY_TOPIC } from './lib/queue';

describe('Observability & Queue basics', () => {
  beforeAll(async () => {
    process.env.QUEUE_DRIVER = 'memory';
    process.env.DATA_DRIVER = 'fs';
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
