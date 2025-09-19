import { jest } from '@jest/globals';
import { ResponsesRunService } from '../../src/services/responses/runService';
import { ResponsesRunCoordinator } from '../../src/services/responses/runCoordinator';
import type { ResponsesRequest } from '../../src/shared/openai/responsesSchemas';

const baseRequest: Partial<ResponsesRequest> & { input: ResponsesRequest['input'] } = {
  model: 'gpt-4.1-mini',
  input: 'plan my day',
};

describe('ResponsesRunService', () => {
  const startRunMock = jest.fn(async () => ({
    request: {
      model: 'gpt-4.1-mini',
      input: 'plan my day',
      metadata: { tenant: 'alpha' },
      tools: [],
      max_tool_calls: 3,
      tool_choice: { type: 'function', function: { name: 'store_notes' } },
    },
    context: { storeFlag: true },
  }));

  const coordinator: jest.Mocked<ResponsesRunCoordinator> = {
    startRun: startRunMock,
    handleEvent: jest.fn(),
    getArchive: jest.fn(),
    getLastRateLimitSnapshot: jest.fn(),
    getBufferedMessages: jest.fn(() => [{ id: 'msg', text: 'hello' }]),
    getBufferedReasoning: jest.fn(() => ['reasoned']),
    getBufferedRefusals: jest.fn(() => ['nope']),
  } as unknown as jest.Mocked<ResponsesRunCoordinator>;

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('executes run and returns buffered information', async () => {
    const service = new ResponsesRunService(coordinator);
    const result = await service.execute({
      tenantId: 'tenant-a',
      request: baseRequest,
      metadata: { tenant: 'alpha' },
      tools: { include: ['store_notes'] },
      maxToolCalls: 3,
      toolChoice: { type: 'function', function: { name: 'store_notes' } },
    });

    expect(result.bufferedMessages[0].text).toBe('hello');
    expect(coordinator.startRun).toHaveBeenCalledTimes(1);
    expect(coordinator.startRun.mock.calls[0][0].maxToolCalls).toBe(3);
    expect(result.refusals[0]).toBe('nope');
  });

  it('rejects invalid maxToolCalls', async () => {
    const service = new ResponsesRunService(coordinator);
    await expect(
      service.execute({ tenantId: 'tenant-b', request: baseRequest, maxToolCalls: 0 }),
    ).rejects.toThrow('maxToolCalls must be a positive integer');
  });

  it('rejects unknown tool choice names', async () => {
    const service = new ResponsesRunService(coordinator);
    await expect(
      service.execute({
        tenantId: 'tenant-c',
        request: baseRequest,
        toolChoice: { type: 'function', function: { name: 'missing' } },
        tools: { include: ['store_notes'] },
      }),
    ).rejects.toThrow('toolChoice refers to missing which is not included in tools');
  });
});
