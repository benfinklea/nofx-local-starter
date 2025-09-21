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

  it('aggregates audio, image, and input transcription artifacts', () => {
    const buffer = new StreamingBuffer();
    buffer.handleEvent({ type: 'response.output_item.added', item: { id: 'msg_audio', type: 'message', role: 'assistant' } });
    buffer.handleEvent({ type: 'response.output_audio.delta', item_id: 'msg_audio', delta: 'QUJD', format: 'mp3' });
    buffer.handleEvent({ type: 'response.output_audio_transcript.delta', item_id: 'msg_audio', delta: 'Hel' });
    buffer.handleEvent({ type: 'response.output_audio_transcript.done', item_id: 'msg_audio', transcript: 'Hello there' });
    buffer.handleEvent({ type: 'response.output_audio.done', item_id: 'msg_audio', format: 'mp3' });

    buffer.handleEvent({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'user_audio', delta: 'Hi' });
    buffer.handleEvent({ type: 'conversation.item.input_audio_transcription.done', item_id: 'user_audio', transcript: 'Hi team' });

    buffer.handleEvent({ type: 'response.image_generation_call.partial_image', item_id: 'img_1', partial_image_b64: 'AAA' });
    buffer.handleEvent({
      type: 'response.image_generation_call.completed',
      item_id: 'img_1',
      b64_json: 'BBB',
      size: '1024x1024',
      background: 'transparent',
    });

    const audio = buffer.getOutputAudioSegments();
    expect(audio).toHaveLength(1);
    expect(audio[0]).toMatchObject({ itemId: 'msg_audio', audioBase64: 'QUJD', format: 'mp3', transcript: 'Hello there' });

    const transcripts = buffer.getInputAudioTranscripts();
    expect(transcripts).toEqual([{ itemId: 'user_audio', transcript: 'Hi team' }]);

    const images = buffer.getImageArtifacts();
    expect(images).toEqual([
      {
        itemId: 'img_1',
        b64JSON: 'BBB',
        imageUrl: undefined,
        background: 'transparent',
        size: '1024x1024',
        createdAt: undefined,
      },
    ]);
  });
});
