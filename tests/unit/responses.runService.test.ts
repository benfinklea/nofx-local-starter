import { jest } from '@jest/globals';
import crypto from 'node:crypto';
import { ResponsesRunService } from '../../src/services/responses/runService';
import { ResponsesRunCoordinator } from '../../src/services/responses/runCoordinator';
import type { ResponsesRequest } from '../../src/shared/openai/responsesSchemas';

const baseRequest: Partial<ResponsesRequest> & { input: ResponsesRequest['input'] } = {
  model: 'gpt-4.1-mini',
  input: 'plan my day',
  safety_identifier: 'user@example.com',
};

const expectedHash = crypto.createHash('sha256').update('user@example.com').digest('hex');

describe('ResponsesRunService', () => {
  const startRunMock = jest.fn(async (input: any) => ({
    request: {
      model: 'gpt-4.1-mini',
      input: 'plan my day',
      metadata: input.request.metadata,
      tools: [],
      max_tool_calls: 3,
      tool_choice: { type: 'function', function: { name: 'store_notes' } },
    },
    context: { storeFlag: true },
  }));

  const archiveStub = {
    getRun: jest.fn(() => ({
      runId: 'run_123',
      request: baseRequest as ResponsesRequest,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
      traceId: 'trace_abc',
      safety: {
        hashedIdentifier: expectedHash,
        refusalCount: 2,
        lastRefusalAt: new Date('2024-01-01T00:00:00Z'),
        moderatorNotes: [],
      },
    })),
  };

  const coordinator: jest.Mocked<ResponsesRunCoordinator> = {
    startRun: startRunMock,
    handleEvent: jest.fn(),
    getArchive: jest.fn(() => archiveStub as any),
    getLastRateLimitSnapshot: jest.fn(),
    getBufferedMessages: jest.fn(() => [{ id: 'msg', text: 'hello' }]),
    getBufferedReasoning: jest.fn(() => ['reasoned']),
    getBufferedRefusals: jest.fn(() => ['nope']),
    registerSafetyHash: jest.fn(),
  } as unknown as jest.Mocked<ResponsesRunCoordinator>;

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('executes run and returns buffered information', async () => {
    const service = new ResponsesRunService(coordinator);
    const result = await service.execute({
      tenantId: 'tenant-a',
      request: baseRequest,
      metadata: { workflow: 'daily' },
      tools: { include: ['store_notes'] },
      maxToolCalls: 3,
      toolChoice: { type: 'function', function: { name: 'store_notes' } },
    });

    expect(result.bufferedMessages[0].text).toBe('hello');
    expect(coordinator.startRun).toHaveBeenCalledTimes(1);
    expect(coordinator.startRun.mock.calls[0][0].maxToolCalls).toBe(3);
    expect(coordinator.startRun.mock.calls[0][0].metadata).toMatchObject({ tenant_id: 'tenant-a', workflow: 'daily', safety_identifier_hash: expect.any(String) });
    expect(coordinator.startRun.mock.calls[0][0].request.metadata).toMatchObject({ tenant_id: 'tenant-a', workflow: 'daily', safety_identifier_hash: expectedHash });
    expect(coordinator.startRun.mock.calls[0][0].request.safety_identifier).toBe(expectedHash);
    expect(result.refusals[0]).toBe('nope');
    expect(result.traceId).toBe('trace_abc');
    expect(result.safety?.hashedIdentifier).toBe(expectedHash);
    expect(result.safety?.refusalCount).toBe(2);
    expect(coordinator.registerSafetyHash).toHaveBeenCalledWith(expect.any(String), expectedHash);
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
