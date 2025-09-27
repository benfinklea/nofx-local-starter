/**
 * Comprehensive test suite for src/services/responses/streamBuffer.ts
 * Tests streaming buffer functionality before refactoring
 */

import { StreamingBuffer, type StreamingEvent } from '../streamBuffer';

describe('StreamingBuffer Tests', () => {
  let buffer: StreamingBuffer;

  beforeEach(() => {
    buffer = new StreamingBuffer();
  });

  describe('Constructor', () => {
    it('should initialize with empty state', () => {
      expect(buffer.getAssistantMessages()).toEqual([]);
      expect(buffer.getReasoningSummaries()).toEqual([]);
      expect(buffer.getRefusals()).toEqual([]);
      expect(buffer.getOutputAudioSegments()).toEqual([]);
      expect(buffer.getInputAudioTranscripts()).toEqual([]);
      expect(buffer.getImageArtifacts()).toEqual([]);
    });
  });

  describe('Text Message Processing', () => {
    it('should handle output item added event', () => {
      const event: StreamingEvent = {
        type: 'response.output_item.added',
        item: { id: 'msg-1', type: 'message', role: 'assistant' }
      };

      buffer.handleEvent(event);
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'msg-1', text: '' });
    });

    it('should ignore non-assistant messages', () => {
      const event: StreamingEvent = {
        type: 'response.output_item.added',
        item: { id: 'msg-1', type: 'message', role: 'user' }
      };

      buffer.handleEvent(event);
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(0);
    });

    it('should ignore non-message items', () => {
      const event: StreamingEvent = {
        type: 'response.output_item.added',
        item: { id: 'item-1', type: 'function_call' }
      };

      buffer.handleEvent(event);
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(0);
    });

    it('should accumulate text deltas', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'Hello ' },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'world!' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'msg-1', text: 'Hello world!' });
    });

    it('should handle text done event', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'Hello ' },
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'Hello world!' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'msg-1', text: 'Hello world!' });
    });

    it('should prefer final text over accumulated deltas', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'Draft text' },
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'Final text' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'msg-1', text: 'Final text' });
    });

    it('should create accumulator automatically for text events', () => {
      const event: StreamingEvent = {
        type: 'response.output_text.delta',
        item_id: 'new-msg',
        delta: 'Automatic creation'
      };

      buffer.handleEvent(event);
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'new-msg', text: 'Automatic creation' });
    });

    it('should handle multiple messages in order', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'First message' },
        {
          type: 'response.output_item.added',
          item: { id: 'msg-2', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.done', item_id: 'msg-2', text: 'Second message' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ id: 'msg-1', text: 'First message' });
      expect(messages[1]).toEqual({ id: 'msg-2', text: 'Second message' });
    });
  });

  describe('Audio Processing', () => {
    it('should handle audio delta events', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'chunk1', format: 'wav' },
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'chunk2' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const segments = buffer.getOutputAudioSegments();

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        itemId: 'audio-1',
        audioBase64: 'chunk1chunk2',
        format: 'wav',
        transcript: undefined
      });
    });

    it('should handle audio done event', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'chunk1' },
        { type: 'response.output_audio.done', item_id: 'audio-1', format: 'mp3' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const segments = buffer.getOutputAudioSegments();

      expect(segments).toHaveLength(1);
      expect(segments[0].format).toBe('mp3');
    });

    it('should handle audio transcript deltas', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio_transcript.delta', item_id: 'audio-1', delta: 'Hello ' },
        { type: 'response.output_audio_transcript.delta', item_id: 'audio-1', delta: 'world!' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const segments = buffer.getOutputAudioSegments();

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        itemId: 'audio-1',
        audioBase64: undefined,
        format: undefined,
        transcript: 'Hello world!'
      });
    });

    it('should handle audio transcript done event', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio_transcript.delta', item_id: 'audio-1', delta: 'Draft' },
        { type: 'response.output_audio_transcript.done', item_id: 'audio-1', transcript: 'Final transcript' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const segments = buffer.getOutputAudioSegments();

      expect(segments).toHaveLength(1);
      expect(segments[0].transcript).toBe('Final transcript');
    });

    it('should handle input audio transcription', () => {
      const events: StreamingEvent[] = [
        { type: 'conversation.item.input_audio_transcription.delta', item_id: 'input-1', delta: 'User ' },
        { type: 'conversation.item.input_audio_transcription.delta', item_id: 'input-1', delta: 'speech' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const transcripts = buffer.getInputAudioTranscripts();

      expect(transcripts).toHaveLength(1);
      expect(transcripts[0]).toEqual({
        itemId: 'input-1',
        transcript: 'User speech'
      });
    });

    it('should handle input audio transcription done', () => {
      const events: StreamingEvent[] = [
        { type: 'conversation.item.input_audio_transcription.delta', item_id: 'input-1', delta: 'Draft' },
        { type: 'conversation.item.input_audio_transcription.done', item_id: 'input-1', transcript: 'Final user speech' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const transcripts = buffer.getInputAudioTranscripts();

      expect(transcripts).toHaveLength(1);
      expect(transcripts[0]).toEqual({
        itemId: 'input-1',
        transcript: 'Final user speech'
      });
    });

    it('should exclude input transcripts without content', () => {
      const event: StreamingEvent = {
        type: 'conversation.item.input_audio_transcription.done',
        item_id: 'empty-input',
        transcript: ''
      };

      buffer.handleEvent(event);
      const transcripts = buffer.getInputAudioTranscripts();

      expect(transcripts).toHaveLength(0);
    });

    it('should maintain order for audio segments', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio.delta', item_id: 'audio-2', delta: 'second' },
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'first' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const segments = buffer.getOutputAudioSegments();

      expect(segments).toHaveLength(2);
      expect(segments[0].itemId).toBe('audio-2');
      expect(segments[1].itemId).toBe('audio-1');
    });
  });

  describe('Image Processing', () => {
    it('should handle image partial events', () => {
      const events: StreamingEvent[] = [
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'partial1' },
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'partial2' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const artifacts = buffer.getImageArtifacts();

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toEqual({
        itemId: 'img-1',
        b64JSON: 'partial2', // Last partial is used
        imageUrl: undefined,
        background: null,
        size: undefined,
        createdAt: undefined
      });
    });

    it('should handle image completed events', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const expectedDate = new Date(timestamp * 1000).toISOString();

      const events: StreamingEvent[] = [
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'partial' },
        {
          type: 'response.image_generation_call.completed',
          item_id: 'img-1',
          b64_json: 'final_image',
          image_url: 'https://example.com/image.png',
          background: 'white',
          size: '512x512',
          created_at: timestamp
        }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const artifacts = buffer.getImageArtifacts();

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toEqual({
        itemId: 'img-1',
        b64JSON: 'final_image',
        imageUrl: 'https://example.com/image.png',
        background: 'white',
        size: '512x512',
        createdAt: expectedDate
      });
    });

    it('should preserve null background explicitly', () => {
      const event: StreamingEvent = {
        type: 'response.image_generation_call.completed',
        item_id: 'img-1',
        background: null
      };

      buffer.handleEvent(event);
      const artifacts = buffer.getImageArtifacts();

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].background).toBeNull();
    });

    it('should fall back to partials if no final b64', () => {
      const events: StreamingEvent[] = [
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'partial1' },
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'partial2' },
        { type: 'response.image_generation_call.completed', item_id: 'img-1' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const artifacts = buffer.getImageArtifacts();

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].b64JSON).toBe('partial2');
    });

    it('should maintain order for image artifacts', () => {
      const events: StreamingEvent[] = [
        { type: 'response.image_generation_call.partial_image', item_id: 'img-2', partial_image_b64: 'second' },
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'first' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const artifacts = buffer.getImageArtifacts();

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].itemId).toBe('img-2');
      expect(artifacts[1].itemId).toBe('img-1');
    });
  });

  describe('Reasoning and Refusal Processing', () => {
    it('should collect reasoning summaries', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.reasoning_summary_part.done',
          item_id: 'reasoning-1',
          part: { type: 'summary_text', text: 'First reasoning step' }
        },
        {
          type: 'response.reasoning_summary_part.done',
          item_id: 'reasoning-2',
          part: { type: 'summary_text', text: 'Second reasoning step' }
        }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const summaries = buffer.getReasoningSummaries();

      expect(summaries).toEqual(['First reasoning step', 'Second reasoning step']);
    });

    it('should collect refusals', () => {
      const events: StreamingEvent[] = [
        { type: 'response.refusal.done', item_id: 'refusal-1', refusal: 'Cannot do that' },
        { type: 'response.refusal.done', item_id: 'refusal-2', refusal: 'Policy violation' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const refusals = buffer.getRefusals();

      expect(refusals).toEqual(['Cannot do that', 'Policy violation']);
    });

    it('should return defensive copies of reasoning and refusals', () => {
      const event: StreamingEvent = {
        type: 'response.reasoning_summary_part.done',
        item_id: 'reasoning-1',
        part: { type: 'summary_text', text: 'Original reasoning' }
      };

      buffer.handleEvent(event);
      const summaries1 = buffer.getReasoningSummaries();
      const summaries2 = buffer.getReasoningSummaries();

      // Should be different array instances
      expect(summaries1).not.toBe(summaries2);
      expect(summaries1).toEqual(summaries2);

      // Modifying returned array shouldn't affect internal state
      summaries1.push('Modified');
      const summaries3 = buffer.getReasoningSummaries();
      expect(summaries3).toHaveLength(1);
      expect(summaries3[0]).toBe('Original reasoning');
    });
  });

  describe('Unknown Event Handling', () => {
    it('should ignore unknown event types', () => {
      const event: StreamingEvent = {
        type: 'unknown.event.type',
        some_data: 'value'
      };

      // Should not throw
      expect(() => buffer.handleEvent(event)).not.toThrow();

      // Should not affect any collections
      expect(buffer.getAssistantMessages()).toHaveLength(0);
      expect(buffer.getReasoningSummaries()).toHaveLength(0);
      expect(buffer.getRefusals()).toHaveLength(0);
      expect(buffer.getOutputAudioSegments()).toHaveLength(0);
      expect(buffer.getInputAudioTranscripts()).toHaveLength(0);
      expect(buffer.getImageArtifacts()).toHaveLength(0);
    });

    it('should handle malformed events gracefully', () => {
      const malformedEvents: StreamingEvent[] = [
        { type: 'response.output_text.delta' } as any, // Missing item_id
        { type: 'response.output_item.added' } as any, // Missing item
        { type: 'response.reasoning_summary_part.done', item_id: 'test' } as any, // Missing part
        { type: 'response.refusal.done', item_id: 'test' } as any // Missing refusal
      ];

      malformedEvents.forEach(event => {
        expect(() => buffer.handleEvent(event)).not.toThrow();
      });

      // Should not create any artifacts from malformed events
      expect(buffer.getAssistantMessages()).toHaveLength(0);
      expect(buffer.getReasoningSummaries()).toHaveLength(0);
      expect(buffer.getRefusals()).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed content types in single stream', () => {
      const events: StreamingEvent[] = [
        // Text message
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'Here is an image:' },

        // Image generation
        { type: 'response.image_generation_call.partial_image', item_id: 'img-1', partial_image_b64: 'image_data' },
        { type: 'response.image_generation_call.completed', item_id: 'img-1', b64_json: 'final_image' },

        // Audio response
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'audio_chunk' },
        { type: 'response.output_audio_transcript.done', item_id: 'audio-1', transcript: 'Spoken response' },

        // Reasoning
        {
          type: 'response.reasoning_summary_part.done',
          item_id: 'reasoning-1',
          part: { type: 'summary_text', text: 'I generated an image as requested' }
        }
      ];

      events.forEach(event => buffer.handleEvent(event));

      expect(buffer.getAssistantMessages()).toHaveLength(1);
      expect(buffer.getImageArtifacts()).toHaveLength(1);
      expect(buffer.getOutputAudioSegments()).toHaveLength(1);
      expect(buffer.getReasoningSummaries()).toHaveLength(1);
    });

    it('should handle events for same item in different order', () => {
      const events: StreamingEvent[] = [
        // Audio transcript before audio data
        { type: 'response.output_audio_transcript.done', item_id: 'audio-1', transcript: 'Transcript' },
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'audio_data' },

        // Text done before text deltas (should override)
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'Final text' },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'Delta text' }
      ];

      events.forEach(event => buffer.handleEvent(event));

      const messages = buffer.getAssistantMessages();
      const audioSegments = buffer.getOutputAudioSegments();

      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('Final text'); // Done event should be preserved

      expect(audioSegments).toHaveLength(1);
      expect(audioSegments[0].transcript).toBe('Transcript');
      expect(audioSegments[0].audioBase64).toBe('audio_data');
    });

    it('should handle duplicate item additions gracefully', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        {
          type: 'response.output_item.added',
          item: { id: 'msg-1', type: 'message', role: 'assistant' }
        },
        { type: 'response.output_text.done', item_id: 'msg-1', text: 'Single message' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      // Should only have one message despite duplicate additions
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'msg-1', text: 'Single message' });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty deltas', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: '' },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: 'content' },
        { type: 'response.output_text.delta', item_id: 'msg-1', delta: '' }
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('content');
    });

    it('should handle missing optional fields', () => {
      const events: StreamingEvent[] = [
        { type: 'response.output_audio.delta', item_id: 'audio-1', delta: 'chunk' }, // No format
        { type: 'response.image_generation_call.completed', item_id: 'img-1' } // No optional fields
      ];

      events.forEach(event => buffer.handleEvent(event));

      const audioSegments = buffer.getOutputAudioSegments();
      const imageArtifacts = buffer.getImageArtifacts();

      expect(audioSegments[0].format).toBeUndefined();
      expect(imageArtifacts[0].imageUrl).toBeUndefined();
      expect(imageArtifacts[0].size).toBeUndefined();
    });

    it('should handle items with no content', () => {
      const events: StreamingEvent[] = [
        {
          type: 'response.output_item.added',
          item: { id: 'empty-msg', type: 'message', role: 'assistant' }
        }
        // No text events follow
      ];

      events.forEach(event => buffer.handleEvent(event));
      const messages = buffer.getAssistantMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ id: 'empty-msg', text: '' });
    });
  });
});