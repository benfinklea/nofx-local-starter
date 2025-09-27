/**
 * Buffer Service - extracted from runCoordinator.ts
 * Handles streaming buffer management and resync operations
 */

import { StreamingBuffer, type StreamingEvent } from '../streamBuffer';
import type { ResponsesResult } from '../../../shared/openai/responsesSchemas';
import type { ResponsesArchive, TimelineSnapshot } from '../../../shared/responses/archive';

export class BufferService {
  private readonly buffers = new Map<string, StreamingBuffer>();

  constructor(private readonly archive: ResponsesArchive) {}

  createBuffer(runId: string): void {
    this.buffers.set(runId, new StreamingBuffer());
  }

  getBuffer(runId: string): StreamingBuffer | undefined {
    return this.buffers.get(runId);
  }

  handleBufferEvent(runId: string, event: StreamingEvent): void {
    this.buffers.get(runId)?.handleEvent(event);
  }

  getAssistantMessages(runId: string) {
    return this.buffers.get(runId)?.getAssistantMessages() ?? [];
  }

  getReasoningSummaries(runId: string) {
    return this.buffers.get(runId)?.getReasoningSummaries() ?? [];
  }

  getRefusals(runId: string) {
    return this.buffers.get(runId)?.getRefusals() ?? [];
  }

  getOutputAudioSegments(runId: string) {
    return this.buffers.get(runId)?.getOutputAudioSegments() ?? [];
  }

  getImageArtifacts(runId: string) {
    return this.buffers.get(runId)?.getImageArtifacts() ?? [];
  }

  getInputAudioTranscripts(runId: string) {
    return this.buffers.get(runId)?.getInputAudioTranscripts() ?? [];
  }

  resyncFromArchive(runId: string): void | Promise<void> {
    const maybeTimeline = this.archive.getTimeline(runId);
    if (!maybeTimeline) return;
    if (maybeTimeline instanceof Promise) {
      return maybeTimeline.then((snapshot) => {
        if (snapshot) this.populateBufferFromTimeline(runId, snapshot);
      });
    }
    this.populateBufferFromTimeline(runId, maybeTimeline);
  }

  private populateBufferFromTimeline(runId: string, timeline: TimelineSnapshot): void {
    const buffer = new StreamingBuffer();
    for (const event of timeline.events) {
      buffer.handleEvent(event as unknown as StreamingEvent);
    }
    if (timeline.run.result) {
      this.seedBufferFromResult(buffer, timeline.run.result);
    }
    this.buffers.set(runId, buffer);
  }

  seedBufferFromResult(buffer: StreamingBuffer, result: ResponsesResult): void {
    let fallbackIndex = 0;
    for (const item of result.output ?? []) {
      if (item && item.type === 'reasoning') {
        const reasoningId = typeof (item as any).id === 'string' && (item as any).id.length
          ? (item as any).id
          : `reasoning_${++fallbackIndex}`;
        const summaries = this.collectReasoningSummaries(item as any);
        for (const text of summaries) {
          buffer.handleEvent({
            type: 'response.reasoning_summary_part.done',
            item_id: reasoningId,
            part: { type: 'summary_text', text },
          });
        }
        continue;
      }
      if (item.type !== 'message' || (item as any).role !== 'assistant') continue;
      const message = item as any;
      const itemId = typeof message.id === 'string' && message.id.length ? message.id : `assistant_${++fallbackIndex}`;
      buffer.handleEvent({
        type: 'response.output_item.added',
        item: { id: itemId, type: 'message', role: 'assistant' },
      });

      const parts: any[] = Array.isArray(message.content) ? message.content : [];
      parts.forEach((part) => {
        switch (part.type) {
          case 'output_text':
            buffer.handleEvent({
              type: 'response.output_text.done',
              item_id: itemId,
              text: part.text,
            });
            break;
          case 'reasoning':
            if (part.text) {
              buffer.handleEvent({
                type: 'response.reasoning_summary_part.done',
                item_id: itemId,
                part: { type: 'summary_text', text: part.text },
              });
            }
            break;
          case 'output_audio':
            if (part.audio) {
              buffer.handleEvent({
                type: 'response.output_audio.delta',
                item_id: itemId,
                delta: part.audio,
              });
            }
            buffer.handleEvent({ type: 'response.output_audio.done', item_id: itemId });
            if (part.transcript) {
              buffer.handleEvent({
                type: 'response.output_audio_transcript.done',
                item_id: itemId,
                transcript: part.transcript,
              });
            }
            break;
          case 'tool_call_delta':
            // ignore tool call deltas for synchronous replay
            break;
          default:
            break;
        }
      });
    }
  }

  private collectReasoningSummaries(item: { [key: string]: unknown }): string[] {
    const summaries: string[] = [];
    const candidates: unknown[] = [];

    const maybeArrays = ['reasoning', 'output', 'content'] as const;
    for (const key of maybeArrays) {
      const value = item[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      }
    }

    const pushText = (value: unknown) => {
      if (!value) return;
      if (typeof value === 'string') {
        if (value.trim().length) summaries.push(value);
        return;
      }
      if (typeof value !== 'object') return;
      const part = value as { [key: string]: unknown };
      if (part.type === 'reasoning' && typeof part.text === 'string' && part.text.trim().length) {
        summaries.push(part.text);
      } else if (typeof part.text === 'string' && part.text.trim().length) {
        summaries.push(part.text);
      }
    };

    candidates.forEach(pushText);
    if (typeof item.text === 'string' && item.text.trim().length) {
      summaries.push(item.text);
    }

    return Array.from(new Set(summaries));
  }
}