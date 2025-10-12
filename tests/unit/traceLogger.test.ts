import type { Logger } from 'pino';

jest.mock('../../src/lib/logger', () => {
  return {
    log: {
      info: jest.fn(),
      debug: jest.fn()
    }
  } satisfies { log: Pick<Logger, 'info' | 'debug'> };
});

jest.mock('../../src/lib/traceConfig', () => ({
  getTraceStatusSync: jest.fn(() => ({ value: false, source: 'default' })),
  refreshTraceStatus: jest.fn(() => Promise.resolve({ value: false, source: 'default' }))
}));

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
    jest.resetModules();
    process.env.RUN_TRACE_LOG = undefined;
    const traceConfig = require('../../src/lib/traceConfig');
    traceConfig.getTraceStatusSync.mockReturnValue({ value: false, source: 'default' });
    const { trace } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    trace('test-event', { foo: 'bar' });
    expect(mocked.info).not.toHaveBeenCalled();
  });

  it('logs when tracing enabled', async () => {
    jest.resetModules();
    process.env.RUN_TRACE_LOG = undefined;
    const traceConfig = require('../../src/lib/traceConfig');
    traceConfig.getTraceStatusSync.mockReturnValue({ value: true, source: 'settings' });
    const { trace } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    trace('test-event', { foo: 'bar' });
    expect(mocked.info).toHaveBeenCalledWith(expect.objectContaining({ trace: true, event: 'test-event', foo: 'bar' }), expect.stringContaining('test-event'));
  });

  it('supports debug helper', async () => {
    jest.resetModules();
    process.env.RUN_TRACE_LOG = undefined;
    const traceConfig = require('../../src/lib/traceConfig');
    traceConfig.getTraceStatusSync.mockReturnValue({ value: true, source: 'settings' });
    const { traceDebug } = await import('../../src/lib/traceLogger');
    const mocked = require('../../src/lib/logger').log;

    traceDebug('debug-event', { value: 1 });
    expect(mocked.debug).toHaveBeenCalledWith(expect.objectContaining({ trace: true, event: 'debug-event', value: 1 }), expect.stringContaining('debug-event'));
  });
});
