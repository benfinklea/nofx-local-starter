import { validateResponsesRequest, responsesResultSchema } from '../openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../openai/responsesSchemas';

type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete';

export type DelegationStatus = 'requested' | 'completed' | 'failed';

export interface DelegationRecord {
  callId: string;
  toolName: string;
  requestedAt: Date;
  status: DelegationStatus;
  arguments?: unknown;
  completedAt?: Date;
  linkedRunId?: string;
  output?: unknown;
  error?: unknown;
}

export type ModeratorDisposition = 'approved' | 'escalated' | 'blocked' | 'info';

export interface ModeratorNote {
  reviewer: string;
  note: string;
  disposition: ModeratorDisposition;
  recordedAt: Date;
}

export interface SafetySnapshot {
  hashedIdentifier?: string;
  refusalCount: number;
  lastRefusalAt?: Date;
  moderatorNotes: ModeratorNote[];
}

type StartRunInput = {
  runId: string;
  request: ResponsesRequest | unknown;
  conversationId?: string;
  metadata?: Record<string, string>;
  traceId?: string;
  safety?: Partial<SafetySnapshot>;
  delegations?: DelegationRecord[];
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

type SafetyUpdateInput = {
  hashedIdentifier?: string;
  refusalLoggedAt?: Date;
};

export type ModeratorNoteInput = Omit<ModeratorNote, 'recordedAt'> & { recordedAt?: Date };

export interface RunRecord {
  runId: string;
  request: ResponsesRequest;
  conversationId?: string;
  metadata?: Record<string, string>;
  status: RunStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: ResponsesResult;
  traceId?: string;
  safety?: SafetySnapshot;
  delegations?: DelegationRecord[];
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

export interface RollbackOptions {
  sequence?: number;
  toolCallId?: string;
  operator?: string;
  reason?: string;
}

export interface ResponsesArchive {
  startRun(input: StartRunInput): RunRecord | Promise<RunRecord>;
  recordEvent(runId: string, input: RecordEventInput): EventRecord | Promise<EventRecord>;
  updateStatus(input: UpdateStatusInput): RunRecord | Promise<RunRecord>;
  getRun(runId: string): RunRecord | undefined | Promise<RunRecord | undefined>;
  getTimeline(runId: string): TimelineSnapshot | undefined | Promise<TimelineSnapshot | undefined>;
  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined | Promise<TimelineSnapshot | undefined>;
  listRuns(): RunRecord[] | Promise<RunRecord[]>;
  deleteRun?(runId: string): void | Promise<void>;
  pruneOlderThan?(cutoff: Date): void | Promise<void>;
  updateSafety?(runId: string, input: SafetyUpdateInput): SafetySnapshot | Promise<SafetySnapshot>;
  addModeratorNote?(runId: string, input: ModeratorNoteInput): ModeratorNote | Promise<ModeratorNote>;
  exportRun?(runId: string): string | Promise<string>;
  recordDelegation?(runId: string, record: DelegationRecord): DelegationRecord | Promise<DelegationRecord>;
  updateDelegation?(runId: string, callId: string, updates: Partial<DelegationRecord>): DelegationRecord | Promise<DelegationRecord>;
  rollback?(runId: string, options: RollbackOptions): TimelineSnapshot | Promise<TimelineSnapshot>;
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
      traceId: input.traceId,
      safety: {
        hashedIdentifier: input.safety?.hashedIdentifier,
        refusalCount: input.safety?.refusalCount ?? 0,
        lastRefusalAt: input.safety?.lastRefusalAt,
        moderatorNotes: input.safety?.moderatorNotes ? [...input.safety.moderatorNotes] : [],
      },
      delegations: input.delegations ? input.delegations.map(cloneDelegation) : [],
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

  listRuns(): RunRecord[] {
    return Array.from(this.runs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

  deleteRun(runId: string): void {
    this.runs.delete(runId);
    this.events.delete(runId);
  }

  pruneOlderThan(cutoff: Date): void {
    for (const [runId, record] of this.runs.entries()) {
      if (record.updatedAt < cutoff) {
        this.deleteRun(runId);
      }
    }
  }

  updateSafety(runId: string, input: SafetyUpdateInput): SafetySnapshot {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    if (input.hashedIdentifier) {
      safety.hashedIdentifier = input.hashedIdentifier;
    }
    if (input.refusalLoggedAt) {
      safety.refusalCount = (safety.refusalCount ?? 0) + 1;
      safety.lastRefusalAt = input.refusalLoggedAt;
    }
    run.safety = {
      hashedIdentifier: safety.hashedIdentifier,
      refusalCount: safety.refusalCount,
      lastRefusalAt: safety.lastRefusalAt,
      moderatorNotes: [...(safety.moderatorNotes ?? [])],
    };
    this.runs.set(runId, run);
    return run.safety;
  }

  addModeratorNote(runId: string, input: ModeratorNoteInput): ModeratorNote {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const note: ModeratorNote = {
      reviewer: input.reviewer,
      note: input.note,
      disposition: input.disposition,
      recordedAt: input.recordedAt ?? new Date(),
    };
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    safety.moderatorNotes = [...(safety.moderatorNotes ?? []), note];
    run.safety = safety;
    this.runs.set(runId, run);
    return note;
  }

  recordDelegation(runId: string, record: DelegationRecord): DelegationRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const delegations = [...(run.delegations ?? [])];
    const normalized = cloneDelegation(record);
    const existing = delegations.findIndex((entry) => entry.callId === normalized.callId);
    if (existing >= 0) {
      delegations.splice(existing, 1, normalized);
    } else {
      delegations.push(normalized);
    }
    this.runs.set(runId, { ...run, delegations, updatedAt: new Date() });
    return cloneDelegation(normalized);
  }

  updateDelegation(runId: string, callId: string, updates: Partial<DelegationRecord>): DelegationRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const delegations = [...(run.delegations ?? [])];
    const index = delegations.findIndex((entry) => entry.callId === callId);
    if (index < 0) throw new Error(`delegation ${callId} not found for run ${runId}`);
    const existing = delegations[index];
    const updated: DelegationRecord = {
      ...existing,
      ...updates,
      requestedAt: updates.requestedAt ? new Date(updates.requestedAt) : existing.requestedAt,
      completedAt: updates.completedAt
        ? new Date(updates.completedAt)
        : updates.status && updates.status === 'completed'
        ? new Date()
        : existing.completedAt,
    };
    delegations[index] = cloneDelegation(updated);
    this.runs.set(runId, { ...run, delegations, updatedAt: new Date() });
    return cloneDelegation(updated);
  }

  rollback(runId: string, options: RollbackOptions): TimelineSnapshot {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const events = this.events.get(runId) ?? [];
    const { run: updatedRun, events: trimmedEvents } = applyRollbackToTimeline(run, events, options);
    this.runs.set(runId, updatedRun);
    this.events.set(runId, trimmedEvents);
    return {
      run: updatedRun,
      events: [...trimmedEvents],
    };
  }
}

function cloneDelegation(record: DelegationRecord): DelegationRecord {
  return {
    callId: record.callId,
    toolName: record.toolName,
    requestedAt: new Date(record.requestedAt),
    status: record.status,
    arguments: record.arguments,
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
    linkedRunId: record.linkedRunId,
    output: record.output,
    error: record.error,
  };
}

function eventMatchesToolCall(event: EventRecord, callId: string): boolean {
  const payload = event.payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (obj.call_id === callId || obj.callId === callId) return true;
    if (obj.id === callId && (obj.type === 'tool_call' || obj.type === 'message')) return true;
    if (obj.item && typeof obj.item === 'object' && (obj.item as any).id === callId) return true;
  }
  return false;
}

export function applyRollbackToTimeline(
  run: RunRecord,
  events: EventRecord[],
  options: RollbackOptions,
): { run: RunRecord; events: EventRecord[] } {
  let workingEvents = [...events];
  if (typeof options.sequence === 'number') {
    workingEvents = workingEvents.filter((event) => event.sequence <= options.sequence!);
  }
  if (options.toolCallId) {
    workingEvents = workingEvents.filter((event) => !eventMatchesToolCall(event, options.toolCallId!));
  }

  const reindexedEvents = workingEvents.map((event, idx) => ({ ...event, sequence: idx + 1 }));
  const updatedResult = run.result ? stripToolCallFromResult(run.result, options.toolCallId) : run.result;

  const metadata: Record<string, string> = {
    ...(run.metadata ?? {}),
    last_rollback_at: new Date().toISOString(),
  };
  if (options.sequence !== undefined) {
    metadata.last_rollback_sequence = String(options.sequence);
  }
  if (options.operator) {
    metadata.last_rollback_operator = options.operator;
  }
  if (options.reason) {
    metadata.last_rollback_reason = options.reason;
  }
  if (options.toolCallId) {
    metadata.last_rollback_tool_call = options.toolCallId;
  }

  const updatedRun: RunRecord = {
    ...run,
    result: updatedResult,
    metadata,
    updatedAt: new Date(),
  };

  return { run: updatedRun, events: reindexedEvents };
}

function stripToolCallFromResult(result: ResponsesResult, toolCallId?: string): ResponsesResult {
  if (!toolCallId) return result;
  const next: ResponsesResult['output'] = [];
  for (const item of result.output ?? []) {
    if (!item) continue;
    if ((item as any).id === toolCallId || (item as any).call_id === toolCallId) {
      continue;
    }
    if (item.type === 'message') {
      const filteredContent = Array.isArray(item.content)
        ? item.content.filter((part) => !('call_id' in (part as any) && (part as any).call_id === toolCallId))
        : item.content;
      next.push({ ...item, content: filteredContent });
      continue;
    }
    next.push(item);
  }

  return {
    ...result,
    output: next,
  };
}
