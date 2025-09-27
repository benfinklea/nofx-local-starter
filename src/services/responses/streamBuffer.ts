// Import types and services
import type { StreamingEvent, AssistantMessageSnapshot } from './streamBuffer/types';
import { EventTypeGuards } from './streamBuffer/EventTypeGuards';
import { TextMessageService } from './streamBuffer/TextMessageService';
import { AudioProcessingService } from './streamBuffer/AudioProcessingService';
import { ImageArtifactService } from './streamBuffer/ImageArtifactService';
import { ReasoningCollectionService } from './streamBuffer/ReasoningCollectionService';

// Re-export types for backwards compatibility
export type { StreamingEvent } from './streamBuffer/types';

export class StreamingBuffer {
  // Extracted services
  private readonly textMessageService: TextMessageService;
  private readonly audioProcessingService: AudioProcessingService;
  private readonly imageArtifactService: ImageArtifactService;
  private readonly reasoningCollectionService: ReasoningCollectionService;

  constructor() {
    this.textMessageService = new TextMessageService();
    this.audioProcessingService = new AudioProcessingService();
    this.imageArtifactService = new ImageArtifactService();
    this.reasoningCollectionService = new ReasoningCollectionService();
  }

  handleEvent(event: StreamingEvent): void {
    switch (event.type) {
      case 'response.output_item.added':
        if (EventTypeGuards.isOutputItemAddedEvent(event)) {
          this.textMessageService.handleItemAdded(event);
        }
        break;
      case 'response.output_text.delta':
        if (EventTypeGuards.isOutputTextDeltaEvent(event)) {
          this.textMessageService.appendDelta(event);
        }
        break;
      case 'response.output_text.done':
        if (EventTypeGuards.isOutputTextDoneEvent(event)) {
          this.textMessageService.completeMessage(event);
        }
        break;
      case 'response.output_audio.delta':
        if (EventTypeGuards.isOutputAudioDeltaEvent(event)) {
          this.audioProcessingService.appendAudioChunk(event);
        }
        break;
      case 'response.output_audio.done':
        if (EventTypeGuards.isOutputAudioDoneEvent(event)) {
          this.audioProcessingService.finalizeAudio(event);
        }
        break;
      case 'response.output_audio_transcript.delta':
        if (EventTypeGuards.isOutputAudioTranscriptDeltaEvent(event)) {
          this.audioProcessingService.appendAudioTranscriptDelta(event);
        }
        break;
      case 'response.output_audio_transcript.done':
        if (EventTypeGuards.isOutputAudioTranscriptDoneEvent(event)) {
          this.audioProcessingService.finalizeAudioTranscript(event);
        }
        break;
      case 'conversation.item.input_audio_transcription.delta':
        if (EventTypeGuards.isInputAudioTranscriptionDeltaEvent(event)) {
          this.audioProcessingService.appendInputTranscriptDelta(event);
        }
        break;
      case 'conversation.item.input_audio_transcription.done':
        if (EventTypeGuards.isInputAudioTranscriptionDoneEvent(event)) {
          this.audioProcessingService.finalizeInputTranscript(event);
        }
        break;
      case 'response.reasoning_summary_part.done':
        if (EventTypeGuards.isReasoningSummaryEvent(event)) {
          this.reasoningCollectionService.addReasoningSummary(event);
        }
        break;
      case 'response.refusal.done':
        if (EventTypeGuards.isRefusalEvent(event)) {
          this.reasoningCollectionService.addRefusal(event);
        }
        break;
      case 'response.image_generation_call.partial_image':
        if (EventTypeGuards.isImagePartialEvent(event)) {
          this.imageArtifactService.appendImagePartial(event);
        }
        break;
      case 'response.image_generation_call.completed':
        if (EventTypeGuards.isImageCompletedEvent(event)) {
          this.imageArtifactService.finalizeImage(event);
        }
        break;
      default:
        break;
    }
  }

  getAssistantMessages(): AssistantMessageSnapshot[] {
    return this.textMessageService.getAssistantMessages();
  }

  getReasoningSummaries(): string[] {
    return this.reasoningCollectionService.getReasoningSummaries();
  }

  getRefusals(): string[] {
    return this.reasoningCollectionService.getRefusals();
  }

  getOutputAudioSegments() {
    return this.audioProcessingService.getOutputAudioSegments();
  }

  getInputAudioTranscripts() {
    return this.audioProcessingService.getInputAudioTranscripts();
  }

  getImageArtifacts() {
    return this.imageArtifactService.getImageArtifacts();
  }
}
