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

export type StreamingEvent =
  | OutputItemAddedEvent
  | OutputTextDeltaEvent
  | OutputTextDoneEvent
  | ReasoningSummaryEvent
  | RefusalEvent
  | { type: string; [key: string]: unknown };

interface AssistantMessageSnapshot {
  id: string;
  text: string;
}

interface MessageAccumulator {
  deltas: string[];
  text?: string;
}

export class StreamingBuffer {
  private readonly messages = new Map<string, MessageAccumulator>();

  private readonly order: string[] = [];

  private readonly reasoning: string[] = [];

  private readonly refusals: string[] = [];

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

  private createAccumulator(id: string): MessageAccumulator {
    if (!this.messages.has(id)) {
      this.messages.set(id, { deltas: [] });
      this.order.push(id);
    }
    return this.messages.get(id)!;
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

function isReasoningSummaryEvent(event: StreamingEvent): event is ReasoningSummaryEvent {
  return 'part' in event && typeof (event as ReasoningSummaryEvent).part?.text === 'string';
}

function isRefusalEvent(event: StreamingEvent): event is RefusalEvent {
  return 'refusal' in event && typeof (event as RefusalEvent).refusal === 'string';
}
