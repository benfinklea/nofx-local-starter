import { describe, it, expect, vi } from 'vitest';

describe('Logger redaction', () => {
  it('masks common sensitive fields in output', async () => {
    const { log } = await import('./lib/logger');
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      out += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      return true;
    });
    try {
      log.info({ token: 'sk-test-123', password: 'p@ss', nested: { authorization: 'Bearer x' } }, 'redact-test');
    } finally {
      spy.mockRestore();
    }
    const line = out.trim().split(/\n/).find(l => l.includes('redact-test')) || '';
    expect(line).not.toBe('');
    const parsed = JSON.parse(line);
    expect(parsed.token).toBe('***');
    expect(parsed.password).toBe('***');
    expect(parsed.nested.authorization).toBe('***');
  });
});
