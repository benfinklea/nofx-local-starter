import type { Logger } from 'pino';

jest.mock('../../src/lib/logger', () => {
  return {
    log: {
      info: jest.fn(),
      debug: jest.fn()
    }
  } satisfies { log: Pick<Logger, 'info' | 'debug'> };
});

describe('traceLogger', () => {
  const originalEnv = process.env.RUN_TRACE_LOG;

  afterEach(() => {
    jest.resetModules();
    process.env.RUN_TRACE_LOG = originalEnv;
    const mocked = require('../../src/lib/logger').log;
    mocked.info.mockReset();
    mocked.debug.mockReset();
  });

  it('does nothing when tracing disabled', async () => {
    process.env.RUN_TRACE_LOG = 'false';
    jest.resetModules();
    const { trace } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    trace('test-event', { foo: 'bar' });
    expect(mocked.info).not.toHaveBeenCalled();
  });

  it('logs when tracing enabled', async () => {
    process.env.RUN_TRACE_LOG = 'true';
    jest.resetModules();
    const { trace } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    trace('test-event', { foo: 'bar' });
    expect(mocked.info).toHaveBeenCalledWith(expect.objectContaining({ trace: true, event: 'test-event', foo: 'bar' }), expect.stringContaining('test-event'));
  });

  it('supports debug helper', async () => {
    process.env.RUN_TRACE_LOG = 'true';
    jest.resetModules();
    const { traceDebug } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    traceDebug('debug-event', { value: 1 });
    expect(mocked.debug).toHaveBeenCalledWith(expect.objectContaining({ trace: true, event: 'debug-event', value: 1 }), expect.stringContaining('debug-event'));
  });
});
