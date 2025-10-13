import { describe, it, expect } from '@jest/globals';
import pino from 'pino';
import { PassThrough } from 'stream';

describe('Logger redaction', () => {
  it('masks common sensitive fields in output', async () => {
    // Create a fresh logger with a synchronous stream we control
    const stream = new PassThrough();
    let output = '';

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    const testLogger = pino({
      level: 'info',
      redact: {
        paths: [
          'authorization', 'token', 'secret', 'password', 'apiKey', 'apikey',
          '*.authorization', '*.token', '*.secret', '*.password', '*.apiKey', '*.apikey',
          'headers.authorization', 'req.headers.authorization'
        ],
        censor: '***'
      }
    }, stream);

    // Log test data
    testLogger.info({
      token: 'sk-test-123',
      password: 'p@ss',
      nested: { authorization: 'Bearer x' }
    }, 'redact-test');

    // Wait for async write
    await new Promise(resolve => setImmediate(resolve));

    const line = output.trim().split(/\n/).find(l => l.includes('redact-test')) || '';
    expect(line).not.toBe('');
    const parsed = JSON.parse(line);
    expect(parsed.token).toBe('***');
    expect(parsed.password).toBe('***');
    expect(parsed.nested.authorization).toBe('***');

    stream.end();
  });
});
