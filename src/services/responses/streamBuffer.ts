interface OutputItemAddedEvent {
  type: 'response.output_item.added';
  item: { id: string; type: string; role?: string };
}

interface OutputTextDeltaEvent {
  type: 'response.output_text.delta';
  item_id: string;
  delta: string;
}

interface OutputTextDoneEvent {
  type: 'response.output_text.done';
  item_id: string;
  text?: string;
}

interface OutputAudioDeltaEvent {
  type: 'response.output_audio.delta';
  item_id: string;
  delta: string;
  format?: string;
}

interface OutputAudioDoneEvent {
  type: 'response.output_audio.done';
  item_id: string;
  format?: string;
}

interface OutputAudioTranscriptDeltaEvent {
  type: 'response.output_audio_transcript.delta';
  item_id: string;
  delta: string;
}

interface OutputAudioTranscriptDoneEvent {
  type: 'response.output_audio_transcript.done';
  item_id: string;
  transcript: string;
}

interface InputAudioTranscriptionDeltaEvent {
  type: 'conversation.item.input_audio_transcription.delta';
  item_id: string;
  delta: string;
}

interface InputAudioTranscriptionDoneEvent {
  type: 'conversation.item.input_audio_transcription.done';
  item_id: string;
  transcript: string;
}

interface ReasoningSummaryEvent {
  type: 'response.reasoning_summary_part.done';
  item_id: string;
  part: { type: 'summary_text'; text: string };
}

interface RefusalEvent {
  type: 'response.refusal.done';
  item_id: string;
  refusal: string;
}

interface ImagePartialEvent {
  type: 'response.image_generation_call.partial_image';
  item_id: string;
  partial_image_b64?: string;
  partial_image_index?: number;
}

interface ImageCompletedEvent {
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

interface AssistantMessageSnapshot {
  id: string;
  text: string;
}

interface MessageAccumulator {
  deltas: string[];
  text?: string;
}

interface AudioAccumulator {
  chunks: string[];
  format?: string;
  transcriptChunks: string[];
  transcript?: string;
}

interface TranscriptAccumulator {
  chunks: string[];
  transcript?: string;
}

interface ImageAccumulator {
  partials: string[];
  b64?: string;
  imageUrl?: string;
  background?: string | null;
  size?: string;
  createdAt?: string;
}

export class StreamingBuffer {
  private readonly messages = new Map<string, MessageAccumulator>();

  private readonly order: string[] = [];

  private readonly reasoning: string[] = [];

  private readonly refusals: string[] = [];

  private readonly audio = new Map<string, AudioAccumulator>();

  private readonly audioOrder: string[] = [];

  private readonly inputAudio = new Map<string, TranscriptAccumulator>();

  private readonly inputOrder: string[] = [];

  private readonly images = new Map<string, ImageAccumulator>();

  private readonly imageOrder: string[] = [];

  handleEvent(event: StreamingEvent): void {
    switch (event.type) {
      case 'response.output_item.added':
        if (isOutputItemAddedEvent(event)) {
          this.handleItemAdded(event);
        }
        break;
      case 'response.output_text.delta':
        if (isOutputTextDeltaEvent(event)) {
          this.appendDelta(event);
        }
        break;
      case 'response.output_text.done':
        if (isOutputTextDoneEvent(event)) {
          this.completeMessage(event);
        }
        break;
      case 'response.output_audio.delta':
        if (isOutputAudioDeltaEvent(event)) {
          this.appendAudioChunk(event);
        }
        break;
      case 'response.output_audio.done':
        if (isOutputAudioDoneEvent(event)) {
          this.finalizeAudio(event);
        }
        break;
      case 'response.output_audio_transcript.delta':
        if (isOutputAudioTranscriptDeltaEvent(event)) {
          this.appendAudioTranscriptDelta(event);
        }
        break;
      case 'response.output_audio_transcript.done':
        if (isOutputAudioTranscriptDoneEvent(event)) {
          this.finalizeAudioTranscript(event);
        }
        break;
      case 'conversation.item.input_audio_transcription.delta':
        if (isInputAudioTranscriptionDeltaEvent(event)) {
          this.appendInputTranscriptDelta(event);
        }
        break;
      case 'conversation.item.input_audio_transcription.done':
        if (isInputAudioTranscriptionDoneEvent(event)) {
          this.finalizeInputTranscript(event);
        }
        break;
      case 'response.reasoning_summary_part.done':
        if (isReasoningSummaryEvent(event)) {
          this.reasoning.push(event.part.text);
        }
        break;
      case 'response.refusal.done':
        if (isRefusalEvent(event)) {
          this.refusals.push(event.refusal);
        }
        break;
      case 'response.image_generation_call.partial_image':
        if (isImagePartialEvent(event)) {
          this.appendImagePartial(event);
        }
        break;
      case 'response.image_generation_call.completed':
        if (isImageCompletedEvent(event)) {
          this.finalizeImage(event);
        }
        break;
      default:
        break;
    }
  }

  getAssistantMessages(): AssistantMessageSnapshot[] {
    return this.order
      .map((id) => {
        const acc = this.messages.get(id);
        if (!acc) return undefined;
        const text = acc.text ?? acc.deltas.join('');
        return { id, text };
      })
      .filter((entry): entry is AssistantMessageSnapshot => Boolean(entry));
  }

  getReasoningSummaries(): string[] {
    return [...this.reasoning];
  }

  getRefusals(): string[] {
    return [...this.refusals];
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

  getImageArtifacts() {
    const artifacts: Array<{ itemId: string; b64JSON?: string; imageUrl?: string; background?: string | null; size?: string; createdAt?: string }> = [];
    for (const id of this.imageOrder) {
      const acc = this.images.get(id);
      if (!acc) continue;
      artifacts.push({
        itemId: id,
        b64JSON: acc.b64 ?? (acc.partials.length ? acc.partials[acc.partials.length - 1] : undefined),
        imageUrl: acc.imageUrl,
        background: acc.background ?? null,
        size: acc.size,
        createdAt: acc.createdAt,
      });
    }
    return artifacts;
  }

  private handleItemAdded(event: OutputItemAddedEvent): void {
    if (event.item.type !== 'message' || event.item.role !== 'assistant') return;
    if (this.messages.has(event.item.id)) return;
    this.messages.set(event.item.id, { deltas: [] });
    this.order.push(event.item.id);
  }

  private appendDelta(event: OutputTextDeltaEvent): void {
    const acc = this.messages.get(event.item_id) ?? this.createAccumulator(event.item_id);
    acc.deltas.push(event.delta);
  }

  private completeMessage(event: OutputTextDoneEvent): void {
    const acc = this.messages.get(event.item_id) ?? this.createAccumulator(event.item_id);
    acc.text = event.text ?? acc.deltas.join('');
  }

  private appendAudioChunk(event: OutputAudioDeltaEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.chunks.push(event.delta);
    if (event.format) {
      acc.format = event.format;
    }
  }

  private finalizeAudio(event: OutputAudioDoneEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    if (event.format) {
      acc.format = event.format;
    }
  }

  private appendAudioTranscriptDelta(event: OutputAudioTranscriptDeltaEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.transcriptChunks.push(event.delta);
  }

  private finalizeAudioTranscript(event: OutputAudioTranscriptDoneEvent): void {
    const acc = this.getAudioAccumulator(event.item_id);
    acc.transcript = event.transcript;
  }

  private appendInputTranscriptDelta(event: InputAudioTranscriptionDeltaEvent): void {
    const acc = this.getInputAccumulator(event.item_id);
    acc.chunks.push(event.delta);
  }

  private finalizeInputTranscript(event: InputAudioTranscriptionDoneEvent): void {
    const acc = this.getInputAccumulator(event.item_id);
    acc.transcript = event.transcript;
  }

  private appendImagePartial(event: ImagePartialEvent): void {
    const acc = this.getImageAccumulator(event.item_id);
    if (event.partial_image_b64) {
      acc.partials.push(event.partial_image_b64);
    }
  }

  private finalizeImage(event: ImageCompletedEvent): void {
    const acc = this.getImageAccumulator(event.item_id);
    acc.b64 = event.b64_json ?? acc.b64;
    if (event.image_url) {
      acc.imageUrl = event.image_url;
    }
    if (event.background !== undefined) {
      acc.background = event.background;
    }
    if (event.size) {
      acc.size = event.size;
    }
    if (event.created_at) {
      acc.createdAt = new Date(event.created_at * 1000).toISOString();
    }
  }

  private createAccumulator(id: string): MessageAccumulator {
    if (!this.messages.has(id)) {
      this.messages.set(id, { deltas: [] });
      this.order.push(id);
    }
    return this.messages.get(id)!;
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

  private getImageAccumulator(id: string): ImageAccumulator {
    if (!this.images.has(id)) {
      this.images.set(id, { partials: [] });
      this.imageOrder.push(id);
    }
    return this.images.get(id)!;
  }
}

function isOutputItemAddedEvent(event: StreamingEvent): event is OutputItemAddedEvent {
  return 'item' in event && typeof (event as OutputItemAddedEvent).item?.id === 'string';
}

function isOutputTextDeltaEvent(event: StreamingEvent): event is OutputTextDeltaEvent {
  return 'item_id' in event && 'delta' in event;
}

function isOutputTextDoneEvent(event: StreamingEvent): event is OutputTextDoneEvent {
  return 'item_id' in event && event.type === 'response.output_text.done';
}

function isOutputAudioDeltaEvent(event: StreamingEvent): event is OutputAudioDeltaEvent {
  return 'item_id' in event && event.type === 'response.output_audio.delta';
}

function isOutputAudioDoneEvent(event: StreamingEvent): event is OutputAudioDoneEvent {
  return 'item_id' in event && event.type === 'response.output_audio.done';
}

function isOutputAudioTranscriptDeltaEvent(event: StreamingEvent): event is OutputAudioTranscriptDeltaEvent {
  return 'item_id' in event && event.type === 'response.output_audio_transcript.delta';
}

function isOutputAudioTranscriptDoneEvent(event: StreamingEvent): event is OutputAudioTranscriptDoneEvent {
  return 'item_id' in event && event.type === 'response.output_audio_transcript.done' && 'transcript' in event;
}

function isInputAudioTranscriptionDeltaEvent(event: StreamingEvent): event is InputAudioTranscriptionDeltaEvent {
  return 'item_id' in event && event.type === 'conversation.item.input_audio_transcription.delta';
}

function isInputAudioTranscriptionDoneEvent(event: StreamingEvent): event is InputAudioTranscriptionDoneEvent {
  return 'item_id' in event && event.type === 'conversation.item.input_audio_transcription.done' && 'transcript' in event;
}

function isReasoningSummaryEvent(event: StreamingEvent): event is ReasoningSummaryEvent {
  return 'part' in event && typeof (event as ReasoningSummaryEvent).part?.text === 'string';
}

function isRefusalEvent(event: StreamingEvent): event is RefusalEvent {
  return 'refusal' in event && typeof (event as RefusalEvent).refusal === 'string';
}

function isImagePartialEvent(event: StreamingEvent): event is ImagePartialEvent {
  return event.type === 'response.image_generation_call.partial_image' && 'item_id' in event;
}

function isImageCompletedEvent(event: StreamingEvent): event is ImageCompletedEvent {
  return event.type === 'response.image_generation_call.completed' && 'item_id' in event;
}
