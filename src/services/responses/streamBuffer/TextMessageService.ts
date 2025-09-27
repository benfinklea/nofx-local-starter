/**
 * Text Message Service - extracted from streamBuffer.ts
 * Handles text message accumulation and processing
 */

import type {
  OutputItemAddedEvent,
  OutputTextDeltaEvent,
  OutputTextDoneEvent,
  MessageAccumulator,
  AssistantMessageSnapshot,
} from './types';

export class TextMessageService {
  private readonly messages = new Map<string, MessageAccumulator>();
  private readonly order: string[] = [];

  handleItemAdded(event: OutputItemAddedEvent): void {
    if (event.item.type !== 'message' || event.item.role !== 'assistant') return;
    if (this.messages.has(event.item.id)) return;
    this.messages.set(event.item.id, { deltas: [] });
    this.order.push(event.item.id);
  }

  appendDelta(event: OutputTextDeltaEvent): void {
    const acc = this.messages.get(event.item_id) ?? this.createAccumulator(event.item_id);
    acc.deltas.push(event.delta);
  }

  completeMessage(event: OutputTextDoneEvent): void {
    const acc = this.messages.get(event.item_id) ?? this.createAccumulator(event.item_id);
    acc.text = event.text ?? acc.deltas.join('');
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

  private createAccumulator(id: string): MessageAccumulator {
    if (!this.messages.has(id)) {
      this.messages.set(id, { deltas: [] });
      this.order.push(id);
    }
    return this.messages.get(id)!;
  }
}