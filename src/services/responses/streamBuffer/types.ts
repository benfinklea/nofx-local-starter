/**
 * Type definitions - extracted from streamBuffer.ts
 * Contains all interface definitions for streaming events and data structures
 */

export interface OutputItemAddedEvent {
  type: 'response.output_item.added';
  item: { id: string; type: string; role?: string };
}

export interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  item_id: string;
  delta: string;
}

export interface OutputTextDoneEvent {
  type: 'response.output_text.done';
  item_id: string;
  text?: string;
}

export interface OutputAudioDeltaEvent {
  type: 'response.output_audio.delta';
  item_id: string;
  delta: string;
  format?: string;
}

export interface OutputAudioDoneEvent {
  type: 'response.output_audio.done';
  item_id: string;
  format?: string;
}

export interface OutputAudioTranscriptDeltaEvent {
  type: 'response.output_audio_transcript.delta';
  item_id: string;
  delta: string;
}

export interface OutputAudioTranscriptDoneEvent {
  type: 'response.output_audio_transcript.done';
  item_id: string;
  transcript: string;
}

export interface InputAudioTranscriptionDeltaEvent {
  type: 'conversation.item.input_audio_transcription.delta';
  item_id: string;
  delta: string;
}

export interface InputAudioTranscriptionDoneEvent {
  type: 'conversation.item.input_audio_transcription.done';
  item_id: string;
  transcript: string;
}

export interface ReasoningSummaryEvent {
  type: 'response.reasoning_summary_part.done';
  item_id: string;
  part: { type: 'summary_text'; text: string };
}

export interface RefusalEvent {
  type: 'response.refusal.done';
  item_id: string;
  refusal: string;
}

export interface ImagePartialEvent {
  type: 'response.image_generation_call.partial_image';
  item_id: string;
  partial_image_b64?: string;
  partial_image_index?: number;
}

export interface ImageCompletedEvent {
  type: 'response.image_generation_call.completed';
  item_id: string;
  b64_json?: string;
  image_url?: string;
  background?: string | null;
  size?: string;
  created_at?: number;
}

export type StreamingEvent =
  | OutputItemAddedEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | OutputAudioDeltaEvent
  | OutputAudioDoneEvent
  | OutputAudioTranscriptDeltaEvent
  | OutputAudioTranscriptDoneEvent
  | InputAudioTranscriptionDeltaEvent
  | InputAudioTranscriptionDoneEvent
  | ReasoningSummaryEvent
  | RefusalEvent
  | ImagePartialEvent
  | ImageCompletedEvent
  | { type: string; [key: string]: unknown };

export interface AssistantMessageSnapshot {
  id: string;
  text: string;
}

export interface MessageAccumulator {
  deltas: string[];
  text?: string;
}

export interface AudioAccumulator {
  chunks: string[];
  format?: string;
  transcriptChunks: string[];
  transcript?: string;
}

export interface TranscriptAccumulator {
  chunks: string[];
  transcript?: string;
}

export interface ImageAccumulator {
  partials: string[];
  b64?: string;
  imageUrl?: string;
  background?: string | null;
  size?: string;
  createdAt?: string;
}