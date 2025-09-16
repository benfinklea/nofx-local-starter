/**
 * Verifies DB fallback from ended_at -> completed_at in store.updateRun/updateStep.
 */

describe('store DB completed_at fallback', () => {
  const ORIG_ENV = { ...process.env } as Record<string,string>;

  afterEach(() => { jest.resetModules(); process.env = { ...ORIG_ENV }; });

  test('updateRun falls back to completed_at', async () => {
    process.env.DATA_DRIVER = 'db';
    const calls: string[] = [];
    jest.doMock('../../src/lib/db', () => ({
      query: jest.fn((sql: string) => {
        calls.push(sql);
        if (/update\s+nofx\.run[\s\S]*ended_at/i.test(sql)) {
          // Simulate ended_at column missing
          return Promise.reject(new Error('column "ended_at" does not exist'));
        }
        return Promise.resolve({ rows: [] });
      })
    }));
    const { store } = await import('../../src/lib/store');
    await store.updateRun('r1', { status: 'succeeded', ended_at: new Date().toISOString() });
    expect(calls.some(c => /update\s+nofx\.run[\s\S]*ended_at/i.test(c))).toBe(true);
    expect(calls.some(c => /update\s+nofx\.run[\s\S]*completed_at/i.test(c))).toBe(true);
  });

  test('updateStep falls back to completed_at', async () => {
    process.env.DATA_DRIVER = 'db';
    const calls: string[] = [];
    jest.doMock('../../src/lib/db', () => ({
      query: jest.fn((sql: string) => {
        calls.push(sql);
        if (/update\s+nofx\.step[\s\S]*ended_at/i.test(sql)) {
          return Promise.reject(new Error('column "ended_at" does not exist'));
        }
        return Promise.resolve({ rows: [] });
      })
    }));
    const { store } = await import('../../src/lib/store');
    await store.updateStep('s1', { status: 'failed', ended_at: new Date().toISOString() });
    expect(calls.some(c => /update\s+nofx\.step[\s\S]*ended_at/i.test(c))).toBe(true);
    expect(calls.some(c => /update\s+nofx\.step[\s\S]*completed_at/i.test(c))).toBe(true);
  });
});

