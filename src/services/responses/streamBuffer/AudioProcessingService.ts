/**
 * Audio Processing Service - extracted from streamBuffer.ts
 * Handles audio chunks, transcripts, and input audio processing
 */

import type {
  OutputAudioDeltaEvent,
  OutputAudioDoneEvent,
  OutputAudioTranscriptDeltaEvent,
  OutputAudioTranscriptDoneEvent,
  InputAudioTranscriptionDeltaEvent,
  InputAudioTranscriptionDoneEvent,
  AudioAccumulator,
  TranscriptAccumulator,
} from './types';

export class AudioProcessingService {
  private readonly audio = new Map<string, AudioAccumulator>();
  private readonly audioOrder: string[] = [];
  private readonly inputAudio = new Map<string, TranscriptAccumulator>();
  private readonly inputOrder: string[] = [];

  appendAudioChunk(event: OutputAudioDeltaEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.chunks.push(event.delta);
    if (event.format) {
      acc.format = event.format;
    }
  }

  finalizeAudio(event: OutputAudioDoneEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    if (event.format) {
      acc.format = event.format;
    }
  }

  appendAudioTranscriptDelta(event: OutputAudioTranscriptDeltaEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.transcriptChunks.push(event.delta);
  }

  finalizeAudioTranscript(event: OutputAudioTranscriptDoneEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.transcript = event.transcript;
  }

  appendInputTranscriptDelta(event: InputAudioTranscriptionDeltaEvent): void {
    const acc = this.getInputAccumulator(event.item_id);
    acc.chunks.push(event.delta);
  }

  finalizeInputTranscript(event: InputAudioTranscriptionDoneEvent): void {
    const acc = this.getInputAccumulator(event.item_id);
    acc.transcript = event.transcript;
  }

  getOutputAudioSegments() {
    const segments: Array<{ itemId: string; audioBase64?: string; format?: string; transcript?: string }> = [];
    for (const id of this.audioOrder) {
      const acc = this.audio.get(id);
      if (!acc) continue;
      segments.push({
        itemId: id,
        audioBase64: acc.chunks.length ? acc.chunks.join('') : undefined,
        format: acc.format,
        transcript: acc.transcript ?? (acc.transcriptChunks.length ? acc.transcriptChunks.join('') : undefined),
      });
    }
    return segments;
  }

  getInputAudioTranscripts() {
    const transcripts: Array<{ itemId: string; transcript: string }> = [];
    for (const id of this.inputOrder) {
      const acc = this.inputAudio.get(id);
      if (!acc) continue;
      const transcript = acc.transcript ?? (acc.chunks.length ? acc.chunks.join('') : undefined);
      if (!transcript) continue;
      transcripts.push({ itemId: id, transcript });
    }
    return transcripts;
  }

  private getAudioAccumulator(id: string): AudioAccumulator {
    if (!this.audio.has(id)) {
      this.audio.set(id, { chunks: [], transcriptChunks: [] });
      this.audioOrder.push(id);
    }
    return this.audio.get(id)!;
  }

  private getInputAccumulator(id: string): TranscriptAccumulator {
    if (!this.inputAudio.has(id)) {
      this.inputAudio.set(id, { chunks: [] });
      this.inputOrder.push(id);
    }
    return this.inputAudio.get(id)!;
  }
}