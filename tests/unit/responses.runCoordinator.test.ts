import { jest } from '@jest/globals';
import { ResponsesRunCoordinator } from '../../src/services/responses/runCoordinator';
import { ConversationStateManager, InMemoryConversationStore } from '../../src/services/responses/conversationStateManager';
import { RateLimitTracker } from '../../src/services/responses/rateLimitTracker';
import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import type { ResponsesRequest, ResponsesResult } from '../../src/shared/openai/responsesSchemas';
import { ToolRegistry } from '../../src/services/responses/toolRegistry';
import { HistoryPlanner } from '../../src/services/responses/historyPlanner';

const createClient = (result: ResponsesResult, headers?: Record<string, string>) => ({
  create: jest.fn(async () => ({ result, headers })),
});

describe('ResponsesRunCoordinator', () => {
  const baseRequest: ResponsesRequest = {
    model: 'gpt-4.1-mini',
    input: 'hello world',
  };

  it('starts a synchronous run, persists completion, and buffers assistant text', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({
      id: 'resp_1',
      status: 'completed',
      output: [
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: 'Hello world',
            },
          ],
        },
      ],
      usage: { total_tokens: 2 },
    });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client });

    await coordinator.startRun({ runId: 'run-10', tenantId: 'tenant-sync', request: baseRequest });

    const timeline = archive.getTimeline('run-10')!;
    expect(timeline.events).toHaveLength(1);
    expect(timeline.run.status).toBe('completed');
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(coordinator.getBufferedMessages('run-10')[0]?.text).toBe('Hello world');
  });

  it('respects vendor conversation policy and captures rate limits', async () => {
    const archive = new InMemoryResponsesArchive();
    const store = new InMemoryConversationStore();
    const conversationManager = new ConversationStateManager(store, { strategy: 'vendor' });
    const tracker = new RateLimitTracker();
    const client = createClient(
      { id: 'resp_2', status: 'completed', output: [], usage: { total_tokens: 5 } },
      { 'x-ratelimit-limit-requests': '3000' },
    );

    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client, rateLimitTracker: tracker });

    const { request } = await coordinator.startRun({
      runId: 'run-11',
      tenantId: 'tenant-vendor',
      request: baseRequest,
      policy: { strategy: 'vendor' },
    });

    expect(request.conversation).toBe('conv_run-11');
    expect(coordinator.getLastRateLimitSnapshot()?.limitRequests).toBe(3000);
  });

  it('queues background runs without invoking the client immediately', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({ id: 'resp_bg', status: 'completed', output: [] });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client });

    await coordinator.startRun({ runId: 'run-12', tenantId: 'tenant-bg', request: baseRequest, background: true });

    expect(client.create).not.toHaveBeenCalled();
    expect(() => coordinator.handleEvent('run-12', { type: 'response.created', sequence_number: 1 })).not.toThrow();
  });

  it('builds tool payloads and honors history planner suggestions', async () => {
    const archive = new InMemoryResponsesArchive();
    const store = new InMemoryConversationStore();
    const conversationManager = new ConversationStateManager(store);
    const client = createClient({ id: 'resp_tools', status: 'completed', output: [] });
    const toolRegistry = new ToolRegistry();
    toolRegistry.registerFunctionTool({
      name: 'store_notes',
      description: 'Persist notes',
      parameters: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] },
    });
    const historyPlanner = new HistoryPlanner({ contextWindowTokens: 128000 });

    const coordinator = new ResponsesRunCoordinator({
      archive,
      conversationManager,
      client,
      toolRegistry,
      historyPlanner,
    });

    const result = await coordinator.startRun({
      runId: 'run-13',
      tenantId: 'tenant-tools',
      request: baseRequest,
      tools: { builtin: ['web_search'], include: ['store_notes'] },
      history: { estimatedTokens: 200000, eventCount: 600, truncation: 'disabled' },
      maxToolCalls: 3,
      toolChoice: { type: 'function', function: { name: 'store_notes' } },
    });

    expect(result.request.tools).toHaveLength(2);
    expect(result.historyPlan?.strategy).toBe('vendor');
    expect(result.context.storeFlag).toBe(true);
    expect(result.request.max_tool_calls).toBe(3);
    expect(result.request.tool_choice).toMatchObject({ function: { name: 'store_notes' } });
  });
});
