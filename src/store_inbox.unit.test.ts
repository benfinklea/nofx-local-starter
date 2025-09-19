import { describe, it, expect, beforeAll } from 'vitest';

describe('Store inbox idempotency (FS)', () => {
  let store: typeof import('./lib/store').store;
  beforeAll(async () => {
    process.env.DATA_DRIVER = 'fs';
    store = (await import('./lib/store')).store;
  });

  it('inboxMarkIfNew returns true once and false thereafter', async () => {
    const key = 'test:inbox:' + Date.now();
    const first = await store.inboxMarkIfNew(key);
    const second = await store.inboxMarkIfNew(key);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

