import { jest } from '@jest/globals';
import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import { ConversationStateManager, InMemoryConversationStore } from '../../src/services/responses/conversationStateManager';
import { ResponsesRunCoordinator } from '../../src/services/responses/runCoordinator';
import type { ResponsesRequest, ResponsesResult } from '../../src/shared/openai/responsesSchemas';

const baseRequest: ResponsesRequest = {
  model: 'gpt-4.1-mini',
  input: 'load test prompt',
};

describe('Responses load profile', () => {
  it('handles concurrent run execution without dropping archive writes', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const responsePayload: ResponsesResult = {
      id: 'resp_stub',
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg_stub',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'ack' }],
        },
      ],
      usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15 },
      model: 'stub-model',
    };
    const client = {
      create: jest.fn(async () => ({ result: responsePayload })),
    };

    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client });
    const totalRuns = 25;
    const runs = Array.from({ length: totalRuns }).map((_, idx) => {
      const runId = `run_load_${idx}`;
      return coordinator.startRun({
        runId,
        tenantId: idx % 2 === 0 ? 'tenant-a' : 'tenant-b',
        request: baseRequest,
      });
    });

    await Promise.all(runs);

    expect(client.create).toHaveBeenCalledTimes(totalRuns);
    expect(archive.listRuns()).toHaveLength(totalRuns);
    const buffered = coordinator.getBufferedMessages('run_load_5');
    expect(buffered[0]?.text).toBe('ack');
  });
});
