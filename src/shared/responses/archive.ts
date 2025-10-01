import { validateResponsesRequest as _validateResponsesRequest, responsesResultSchema as _responsesResultSchema } from '../openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../openai/responsesSchemas';

type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'rolled_back';

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

// Import extracted services
import { RunManagementService } from './archive/RunManagementService';
import { EventManagementService } from './archive/EventManagementService';
import { SafetyManagementService } from './archive/SafetyManagementService';
import { DelegationManagementService } from './archive/DelegationManagementService';
import { RollbackService } from './archive/RollbackService';

export class InMemoryResponsesArchive implements ResponsesArchive {
  private runs = new Map<string, RunRecord>();
  private events = new Map<string, EventRecord[]>();

  // Extracted services
  private readonly runManagementService: RunManagementService;
  private readonly eventManagementService: EventManagementService;
  private readonly safetyManagementService: SafetyManagementService;
  private readonly delegationManagementService: DelegationManagementService;
  private readonly rollbackService: RollbackService;

  constructor() {
    this.runManagementService = new RunManagementService(this.runs, this.events);
    this.eventManagementService = new EventManagementService(this.runs, this.events);
    this.safetyManagementService = new SafetyManagementService(this.runs);
    this.delegationManagementService = new DelegationManagementService(this.runs);
    this.rollbackService = new RollbackService(this.runs, this.events);
  }

  startRun(input: StartRunInput): RunRecord {
    return this.runManagementService.startRun(input);
  }

  recordEvent(runId: string, input: RecordEventInput): EventRecord {
    return this.eventManagementService.recordEvent(runId, input);
  }

  updateStatus(input: UpdateStatusInput): RunRecord {
    return this.runManagementService.updateStatus(input);
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runManagementService.getRun(runId);
  }

  listRuns(): RunRecord[] {
    return this.runManagementService.listRuns();
  }

  getTimeline(runId: string): TimelineSnapshot | undefined {
    return this.eventManagementService.getTimeline(runId);
  }

  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined {
    return this.eventManagementService.snapshotAt(runId, sequence);
  }

  deleteRun(runId: string): void {
    this.runManagementService.deleteRun(runId);
  }

  pruneOlderThan(cutoff: Date): void {
    this.runManagementService.pruneOlderThan(cutoff);
  }

  updateSafety(runId: string, input: SafetyUpdateInput): SafetySnapshot {
    return this.safetyManagementService.updateSafety(runId, input);
  }

  addModeratorNote(runId: string, input: ModeratorNoteInput): ModeratorNote {
    return this.safetyManagementService.addModeratorNote(runId, input);
  }

  recordDelegation(runId: string, record: DelegationRecord): DelegationRecord {
    return this.delegationManagementService.recordDelegation(runId, record);
  }

  updateDelegation(runId: string, callId: string, updates: Partial<DelegationRecord>): DelegationRecord {
    return this.delegationManagementService.updateDelegation(runId, callId, updates);
  }

  rollback(runId: string, options: RollbackOptions): TimelineSnapshot {
    return this.rollbackService.rollback(runId, options);
  }
}

// Re-export applyRollbackToTimeline for backwards compatibility
export { applyRollbackToTimeline } from './archive/RollbackService';
