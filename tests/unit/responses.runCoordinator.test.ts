import { jest } from '@jest/globals';
import { ResponsesRunCoordinator } from '../../src/services/responses/runCoordinator';
import { ConversationStateManager, InMemoryConversationStore } from '../../src/services/responses/conversationStateManager';
import { RateLimitTracker } from '../../src/services/responses/rateLimitTracker';
import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import type { ResponsesRequest, ResponsesResult } from '../../src/shared/openai/responsesSchemas';
import { ToolRegistry } from '../../src/services/responses/toolRegistry';
import { HistoryPlanner } from '../../src/services/responses/historyPlanner';
import { DelegationTracker } from '../../src/services/responses/delegationTracker';

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
            {
              type: 'output_audio',
              audio: 'QUJD',
              transcript: 'Hello world',
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
    const audio = coordinator.getBufferedOutputAudio('run-10');
   expect(audio[0]?.audioBase64).toBe('QUJD');
    expect(audio[0]?.transcript).toBe('Hello world');
  });

  it('buffers reasoning summaries when responses contain reasoning output items', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({
      id: 'resp_reasoning',
      status: 'completed',
      output: [
        {
          type: 'reasoning',
          id: 'reasoning_1',
          status: 'completed',
          reasoning: [
            {
              type: 'reasoning',
              text: 'Reasoned about the problem',
            },
          ],
        },
      ],
    });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client });

    await coordinator.startRun({ runId: 'run-reasoning', tenantId: 'tenant-reasoning', request: baseRequest });

    expect(coordinator.getBufferedReasoning('run-reasoning')).toEqual(['Reasoned about the problem']);
    expect(coordinator.getBufferedMessages('run-reasoning')).toHaveLength(0);
  });

  it('records speech configuration metadata', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({ id: 'resp_speech', status: 'completed', output: [] });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client });

    await coordinator.startRun({
      runId: 'run-speech',
      tenantId: 'tenant-audio',
      request: baseRequest,
      speech: {
        mode: 'server_vad',
        inputFormat: 'pcm16',
        transcription: { enabled: true, model: 'gpt-4o-transcribe' },
      },
    });

    const run = archive.getRun('run-speech');
    expect(run?.metadata?.speech_mode).toBe('server_vad');
    expect(run?.metadata?.speech_input_format).toBe('pcm16');
    expect(run?.metadata?.speech_transcription).toBe('enabled');
    expect(run?.metadata?.speech_transcription_model).toBe('gpt-4o-transcribe');
  });

  it('captures delegation lineage from tool calls', async () => {
    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({ id: 'resp_delegate', status: 'completed', output: [] });
    const delegationTracker = new DelegationTracker({ archive });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client, delegationTracker });

    await coordinator.startRun({ runId: 'run-deleg', tenantId: 'tenant-deleg', request: baseRequest, background: true });
    coordinator.handleEvent('run-deleg', { type: 'response.created', sequence_number: 1 });
    coordinator.handleEvent('run-deleg', {
      type: 'response.function_call_arguments.done',
      sequence_number: 2,
      call_id: 'call_123',
      name: 'delegate_agent',
      arguments: '{"task":"draft"}',
    });
    coordinator.handleEvent('run-deleg', {
      type: 'response.output_item.done',
      sequence_number: 3,
      item: {
        id: 'call_123',
        type: 'tool_call',
        status: 'completed',
        output: { summary: 'ok' },
      },
    });

    const delegations = coordinator.getDelegations('run-deleg');
    expect(delegations).toHaveLength(1);
    expect(delegations[0]!.toolName).toBe('delegate_agent');
    expect(delegations[0]!.status).toBe('completed');
    expect(delegations[0]!.output).toMatchObject({ summary: 'ok' });
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
    expect(coordinator.getLastRateLimitSnapshot('tenant-vendor')?.limitRequests).toBe(3000);
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

  it('records incidents on failure events and resolves them on completion', async () => {
    const incidents: any[] = [];
    const incidentLog = {
      recordIncident: jest.fn((payload: any) => {
        const record = { id: `inc_${incidents.length}`, status: 'open', occurredAt: payload.occurredAt ?? new Date(), ...payload };
        incidents.push(record);
        return record;
      }),
      resolveIncidentsByRun: jest.fn((runId: string, resolution: any) => {
        incidents.forEach((incident) => {
          if (incident.runId === runId && incident.status === 'open') {
            incident.status = 'resolved';
            incident.resolution = resolution;
          }
        });
      }),
      getIncidentsForRun: jest.fn(() => incidents),
      listIncidents: jest.fn(() => incidents),
    } as any;

    const archive = new InMemoryResponsesArchive();
    const conversationManager = new ConversationStateManager(new InMemoryConversationStore());
    const client = createClient({ id: 'resp_bg', status: 'completed', output: [] });
    const coordinator = new ResponsesRunCoordinator({ archive, conversationManager, client, incidentLog });

    await coordinator.startRun({ runId: 'run-incident', tenantId: 'tenant-inc', request: baseRequest, background: true });
    coordinator.handleEvent('run-incident', { type: 'response.failed', sequence_number: 1 });
    expect(incidentLog.recordIncident).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-incident', type: 'failed' }));

    coordinator.handleEvent('run-incident', { type: 'response.completed', sequence_number: 2 });
    expect(incidentLog.resolveIncidentsByRun).toHaveBeenCalledWith('run-incident', expect.objectContaining({ linkedRunId: 'run-incident' }));
  });
});
