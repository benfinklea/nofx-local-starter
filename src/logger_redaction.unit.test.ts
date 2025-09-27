import { describe, it, expect } from '@jest/globals';

describe('Logger redaction', () => {
  it('masks common sensitive fields in output', async () => {
    const { log } = await import('./lib/logger');
    const pino = await import('pino');
    let out = '';
    const streamSym = pino.symbols.streamSym;
    const stream: any = (log as any)[streamSym];
    const originalWrite = stream.write.bind(stream);
    stream.write = (chunk: any, encoding?: any, callback?: any) => {
      out += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      return originalWrite(chunk, encoding, callback);
    };
    try {
      log.info({ token: 'sk-test-123', password: 'p@ss', nested: { authorization: 'Bearer x' } }, 'redact-test');
      await new Promise(resolve => setImmediate(resolve));
    } finally {
      stream.write = originalWrite;
    }
    const line = out.trim().split(/\n/).find(l => l.includes('redact-test')) || '';
    expect(line).not.toBe('');
    const parsed = JSON.parse(line);
    expect(parsed.token).toBe('***');
    expect(parsed.password).toBe('***');
    expect(parsed.nested.authorization).toBe('***');
  });
});
