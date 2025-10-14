import { InMemoryResponsesArchive } from '../../src/shared/responses/archive';
import type { ResponsesRequest } from '../../src/shared/openai/responsesSchemas';

const baseRequest: ResponsesRequest = {
  model: 'gpt-4.1-mini',
  input: 'hello world',
};

describe('Responses archive rollbacks', () => {
  it('trims events when rolling back to a sequence and annotates metadata', () => {
    const archive = new InMemoryResponsesArchive();
    archive.startRun({ runId: 'run-seq', request: baseRequest });
    archive.recordEvent('run-seq', { type: 'response.output_item.added', payload: { item: { id: 'msg_1' } } });
    archive.recordEvent('run-seq', { type: 'response.output_text.done', payload: { text: 'hello' } });
    archive.updateStatus({
      runId: 'run-seq',
      status: 'completed',
      result: {
        id: 'resp_seq',
        status: 'completed',
        output: [
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'hello' }],
          },
        ],
      },
    });

    const snapshot = archive.rollback('run-seq', { sequence: 1, operator: 'qa', reason: 'trim after failure' });
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]!.sequence).toBe(1);
    expect(snapshot.run.metadata?.last_rollback_operator).toBe('qa');
    expect(snapshot.run.metadata?.last_rollback_reason).toBe('trim after failure');
    expect(snapshot.run.metadata?.last_rollback_sequence).toBe('1');
  });

  it('removes tool call output when rolling back a tool execution', () => {
    const archive = new InMemoryResponsesArchive();
    archive.startRun({ runId: 'run-tool', request: baseRequest });
    archive.recordEvent('run-tool', {
      type: 'response.output_item.done',
      payload: { item: { id: 'call_123', type: 'tool_call' } },
    });
    archive.updateStatus({
      runId: 'run-tool',
      status: 'completed',
      result: {
        id: 'resp_tool',
        status: 'completed',
        output: [
          {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'before tool' }],
          },
          {
            type: 'tool_call',
            id: 'call_123',
            status: 'completed',
            output: 'ok',
          },
        ],
      },
    });

    const snapshot = archive.rollback('run-tool', { toolCallId: 'call_123', operator: 'ops' });
    expect(snapshot.run.result?.output).toHaveLength(1);
    expect(snapshot.run.result?.output?.[0]).toMatchObject({ id: 'msg_1' });
    expect(snapshot.events.some((event) => eventMatchesToolCallId(event, 'call_123'))).toBe(false);
    expect(snapshot.run.metadata?.last_rollback_tool_call).toBe('call_123');
    expect(snapshot.run.metadata?.last_rollback_operator).toBe('ops');
  });
});

function eventMatchesToolCallId(event: { payload: unknown }, callId: string): boolean {
  const payload = event.payload;
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  if (candidate.call_id === callId || candidate.callId === callId) return true;
  if (candidate.id === callId) return true;
  if (candidate.item && typeof candidate.item === 'object' && (candidate.item as any).id === callId) return true;
  return false;
}
