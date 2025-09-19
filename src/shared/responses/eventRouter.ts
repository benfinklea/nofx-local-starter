import { InMemoryResponsesArchive, type ResponsesArchive } from './archive';
import type { ResponsesResult } from '../openai/responsesSchemas';

export type ResponsesEvent = {
  type: string;
  sequence_number?: number;
  sequenceNumber?: number;
  response?: ResponsesResult | unknown;
  [key: string]: unknown;
};

const STATUS_BY_EVENT: Record<string, 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete'> = {
  'response.created': 'in_progress',
  'response.in_progress': 'in_progress',
  'response.queued': 'queued',
  'response.completed': 'completed',
  'response.failed': 'failed',
  'response.cancelled': 'cancelled',
  'response.incomplete': 'incomplete',
};

const EVENTS_WITH_RESULT = new Set(['response.completed', 'response.failed', 'response.cancelled', 'response.incomplete']);

type RouterOptions = {
  runId: string;
  archive: ResponsesArchive;
};

export class ResponsesEventRouter {
  private lastSequence = 0;

  private readonly runId: string;

  private readonly archive: ResponsesArchive;

  constructor(opts: RouterOptions) {
    this.runId = opts.runId;
    this.archive = opts.archive;
  }

  handleEvent(event: ResponsesEvent): void {
    const sequence = this.extractSequence(event);
    if (sequence <= this.lastSequence) {
      if (sequence === this.lastSequence) {
        throw new Error(`sequence ${sequence} already recorded for run ${this.runId}`);
      }
      throw new Error(`sequence ${sequence} is stale for run ${this.runId}`);
    }

    this.archive.recordEvent(this.runId, {
      sequence,
      type: event.type,
      payload: event,
    });
    this.lastSequence = sequence;

    const status = STATUS_BY_EVENT[event.type];
    if (!status) return;

    const shouldPersistResult = EVENTS_WITH_RESULT.has(event.type);
    const resultPayload = shouldPersistResult ? event.response : undefined;

    this.archive.updateStatus({
      runId: this.runId,
      status,
      result: resultPayload,
    });
  }

  private extractSequence(event: ResponsesEvent): number {
    const sequence = event.sequence_number ?? event.sequenceNumber;
    if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence <= 0) {
      throw new Error(`invalid sequence number for run ${this.runId}`);
    }
    return sequence;
  }
}

export function createInMemoryRouter(runId: string, archive?: ResponsesArchive) {
  const backing = archive ?? new InMemoryResponsesArchive();
  return new ResponsesEventRouter({ runId, archive: backing });
}
