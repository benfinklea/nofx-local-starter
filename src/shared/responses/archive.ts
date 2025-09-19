import { validateResponsesRequest, responsesResultSchema } from '../openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../openai/responsesSchemas';

type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete';

type StartRunInput = {
  runId: string;
  request: ResponsesRequest | unknown;
  conversationId?: string;
  metadata?: Record<string, string>;
};

type RecordEventInput = {
  sequence?: number;
  type: string;
  payload: unknown;
  occurredAt?: Date;
};

type UpdateStatusInput = {
  runId: string;
  status: RunStatus;
  result?: ResponsesResult | unknown;
};

export interface RunRecord {
  runId: string;
  request: ResponsesRequest;
  conversationId?: string;
  metadata?: Record<string, string>;
  status: RunStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: ResponsesResult;
}

export interface EventRecord {
  runId: string;
  sequence: number;
  type: string;
  payload: unknown;
  occurredAt: Date;
}

export interface TimelineSnapshot {
  run: RunRecord;
  events: EventRecord[];
}

export interface ResponsesArchive {
  startRun(input: StartRunInput): RunRecord;
  recordEvent(runId: string, input: RecordEventInput): EventRecord;
  updateStatus(input: UpdateStatusInput): RunRecord;
  getRun(runId: string): RunRecord | undefined;
  getTimeline(runId: string): TimelineSnapshot | undefined;
  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined;
}

export class InMemoryResponsesArchive implements ResponsesArchive {
  private runs = new Map<string, RunRecord>();

  private events = new Map<string, EventRecord[]>();

  startRun(input: StartRunInput): RunRecord {
    if (this.runs.has(input.runId)) {
      throw new Error(`run ${input.runId} already exists`);
    }
    const request = validateResponsesRequest(input.request);
    const now = new Date();
    const run: RunRecord = {
      runId: input.runId,
      request,
      conversationId: input.conversationId,
      metadata: input.metadata,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.runId, run);
    this.events.set(run.runId, []);
    return run;
  }

  recordEvent(runId: string, input: RecordEventInput): EventRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);

    const runEvents = this.events.get(runId)!;
    const nextSequence =
      input.sequence !== undefined
        ? input.sequence
        : runEvents.length === 0
        ? 1
        : runEvents[runEvents.length - 1].sequence + 1;

    if (runEvents.some((event) => event.sequence === nextSequence)) {
      throw new Error(`sequence ${nextSequence} already recorded for run ${runId}`);
    }

    const record: EventRecord = {
      runId,
      sequence: nextSequence,
      type: input.type,
      payload: input.payload,
      occurredAt: input.occurredAt ?? new Date(),
    };
    runEvents.push(record);
    return record;
  }

  updateStatus(input: UpdateStatusInput): RunRecord {
    const run = this.runs.get(input.runId);
    if (!run) throw new Error(`run ${input.runId} not found`);
    const parsedResult = input.result ? responsesResultSchema.parse(input.result) : undefined;
    const updated: RunRecord = {
      ...run,
      status: input.status,
      result: parsedResult ?? run.result,
      updatedAt: new Date(),
    };
    this.runs.set(input.runId, updated);
    return updated;
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  getTimeline(runId: string): TimelineSnapshot | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    const events = this.events.get(runId) ?? [];
    return {
      run,
      events: [...events],
    };
  }

  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined {
    const snapshot = this.getTimeline(runId);
    if (!snapshot) return undefined;
    return {
      run: snapshot.run,
      events: snapshot.events.filter((event) => event.sequence <= sequence),
    };
  }
}
