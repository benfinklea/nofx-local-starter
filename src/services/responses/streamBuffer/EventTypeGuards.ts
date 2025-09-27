/**
 * Event Type Guards - extracted from streamBuffer.ts
 * Contains type guard functions for event validation
 */

import type { StreamingEvent } from './types';
import type {
  OutputItemAddedEvent,
  OutputTextDeltaEvent,
  OutputTextDoneEvent,
  OutputAudioDeltaEvent,
  OutputAudioDoneEvent,
  OutputAudioTranscriptDeltaEvent,
  OutputAudioTranscriptDoneEvent,
  InputAudioTranscriptionDeltaEvent,
  InputAudioTranscriptionDoneEvent,
  ReasoningSummaryEvent,
  RefusalEvent,
  ImagePartialEvent,
  ImageCompletedEvent,
} from './types';

export class EventTypeGuards {
  static isOutputItemAddedEvent(event: StreamingEvent): event is OutputItemAddedEvent {
    return 'item' in event && typeof (event as OutputItemAddedEvent).item?.id === 'string';
  }

  static isOutputTextDeltaEvent(event: StreamingEvent): event is OutputTextDeltaEvent {
    return 'item_id' in event && 'delta' in event;
  }

  static isOutputTextDoneEvent(event: StreamingEvent): event is OutputTextDoneEvent {
    return 'item_id' in event && event.type === 'response.output_text.done';
  }

  static isOutputAudioDeltaEvent(event: StreamingEvent): event is OutputAudioDeltaEvent {
    return 'item_id' in event && event.type === 'response.output_audio.delta';
  }

  static isOutputAudioDoneEvent(event: StreamingEvent): event is OutputAudioDoneEvent {
    return 'item_id' in event && event.type === 'response.output_audio.done';
  }

  static isOutputAudioTranscriptDeltaEvent(event: StreamingEvent): event is OutputAudioTranscriptDeltaEvent {
    return 'item_id' in event && event.type === 'response.output_audio_transcript.delta';
  }

  static isOutputAudioTranscriptDoneEvent(event: StreamingEvent): event is OutputAudioTranscriptDoneEvent {
    return 'item_id' in event && event.type === 'response.output_audio_transcript.done' && 'transcript' in event;
  }

  static isInputAudioTranscriptionDeltaEvent(event: StreamingEvent): event is InputAudioTranscriptionDeltaEvent {
    return 'item_id' in event && event.type === 'conversation.item.input_audio_transcription.delta';
  }

  static isInputAudioTranscriptionDoneEvent(event: StreamingEvent): event is InputAudioTranscriptionDoneEvent {
    return 'item_id' in event && event.type === 'conversation.item.input_audio_transcription.done' && 'transcript' in event;
  }

  static isReasoningSummaryEvent(event: StreamingEvent): event is ReasoningSummaryEvent {
    return 'part' in event && typeof (event as ReasoningSummaryEvent).part?.text === 'string';
  }

  static isRefusalEvent(event: StreamingEvent): event is RefusalEvent {
    return 'refusal' in event && typeof (event as RefusalEvent).refusal === 'string';
  }

  static isImagePartialEvent(event: StreamingEvent): event is ImagePartialEvent {
    return event.type === 'response.image_generation_call.partial_image' && 'item_id' in event;
  }

  static isImageCompletedEvent(event: StreamingEvent): event is ImageCompletedEvent {
    return event.type === 'response.image_generation_call.completed' && 'item_id' in event;
  }
}