import { StreamingBuffer } from '../../src/services/responses/streamBuffer';

describe('StreamingBuffer', () => {
  it('stitches text deltas into final assistant messages', () => {
    const buffer = new StreamingBuffer();
    buffer.handleEvent({ type: 'response.output_item.added', item: { id: 'msg_1', type: 'message', role: 'assistant' } });
    buffer.handleEvent({ type: 'response.output_text.delta', item_id: 'msg_1', delta: 'Hello' });
    buffer.handleEvent({ type: 'response.output_text.delta', item_id: 'msg_1', delta: ' world' });
    buffer.handleEvent({ type: 'response.output_text.done', item_id: 'msg_1', text: 'Hello world' });

    const timeline = buffer.getAssistantMessages();
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ id: 'msg_1', text: 'Hello world' });
  });

  it('captures reasoning summaries and refusal text when present', () => {
    const buffer = new StreamingBuffer();
    buffer.handleEvent({
      type: 'response.reasoning_summary_part.done',
      item_id: 'msg_reason',
      part: { type: 'summary_text', text: 'Summarized reasoning' },
    });
    buffer.handleEvent({
      type: 'response.refusal.done',
      item_id: 'msg_refusal',
      refusal: 'I must decline',
    });

    expect(buffer.getReasoningSummaries()).toEqual(['Summarized reasoning']);
    expect(buffer.getRefusals()).toEqual(['I must decline']);
  });
});
