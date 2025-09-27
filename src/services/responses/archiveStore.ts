import path from 'node:path';
import type {
  ResponsesArchive,
  RunRecord,
  EventRecord,
  TimelineSnapshot,
  SafetySnapshot,
  ModeratorNote,
  ModeratorNoteInput,
  DelegationRecord,
  RollbackOptions,
} from '../../shared/responses/archive';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';

// Import extracted services
import { FileManagerService } from './archiveStore/FileManagerService';
import { SerializationService } from './archiveStore/SerializationService';
import { RunManagementService } from './archiveStore/RunManagementService';
import { EventManagementService } from './archiveStore/EventManagementService';
import { SafetyManagementService } from './archiveStore/SafetyManagementService';
import { DelegationManagementService } from './archiveStore/DelegationManagementService';
import { ExportService } from './archiveStore/ExportService';

export class FileSystemResponsesArchive implements ResponsesArchive {
  // Extracted services
  private readonly fileManager: FileManagerService;
  private readonly serialization: SerializationService;
  private readonly runManagement: RunManagementService;
  private readonly eventManagement: EventManagementService;
  private readonly safetyManagement: SafetyManagementService;
  private readonly delegationManagement: DelegationManagementService;
  private readonly exportService: ExportService;

  constructor(baseDir = path.join(process.cwd(), 'local_data', 'responses'), opts?: { coldStorageDir?: string; exportDir?: string }) {
    // Initialize services with dependency injection
    this.fileManager = new FileManagerService(baseDir);
    this.serialization = new SerializationService();
    this.runManagement = new RunManagementService(this.fileManager, this.serialization);
    this.eventManagement = new EventManagementService(this.fileManager, this.serialization);
    this.safetyManagement = new SafetyManagementService(this.fileManager, this.serialization);
    this.delegationManagement = new DelegationManagementService(this.fileManager, this.serialization);

    const coldStorageDir = opts?.coldStorageDir ?? process.env.RESPONSES_ARCHIVE_COLD_STORAGE_DIR;
    const exportDir = opts?.exportDir ?? path.join(baseDir, '..', 'exports');
    this.exportService = new ExportService(this.fileManager, this.serialization, baseDir, { coldStorageDir, exportDir });
  }

  startRun(input: {
    runId: string;
    request: ResponsesRequest | unknown;
    conversationId?: string;
    metadata?: Record<string, string>;
    traceId?: string;
    safety?: Partial<SafetySnapshot>;
    delegations?: DelegationRecord[];
  }): RunRecord {
    return this.runManagement.startRun(input);
  }

  recordEvent(runId: string, input: { sequence?: number; type: string; payload: unknown; occurredAt?: Date }): EventRecord {
    const run = this.getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    return this.eventManagement.recordEvent(runId, input);
  }

  updateStatus(input: { runId: string; status: RunRecord['status']; result?: ResponsesResult | unknown }): RunRecord {
    return this.runManagement.updateStatus(input);
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runManagement.getRun(runId);
  }

  getTimeline(runId: string): TimelineSnapshot | undefined {
    return this.eventManagement.getTimeline(runId, (id) => this.getRun(id));
  }

  snapshotAt(runId: string, sequence: number): TimelineSnapshot | undefined {
    return this.eventManagement.snapshotAt(runId, sequence, (id) => this.getRun(id));
  }

  listRuns(): RunRecord[] {
    return this.runManagement.listRuns();
  }

  deleteRun(runId: string): void {
    this.runManagement.deleteRun(runId);
  }

  pruneOlderThan(cutoff: Date): void {
    this.runManagement.pruneOlderThan(cutoff, (runId) => this.exportService.moveToColdStorage(runId));
  }

  updateSafety(runId: string, input: { hashedIdentifier?: string; refusalLoggedAt?: Date }): SafetySnapshot {
    return this.safetyManagement.updateSafety(runId, input, (id) => this.getRun(id));
  }

  addModeratorNote(runId: string, input: ModeratorNoteInput): ModeratorNote {
    return this.safetyManagement.addModeratorNote(runId, input, (id) => this.getRun(id));
  }

  recordDelegation(runId: string, record: DelegationRecord): DelegationRecord {
    return this.delegationManagement.recordDelegation(runId, record, (id) => this.getRun(id));
  }

  updateDelegation(runId: string, callId: string, updates: Partial<DelegationRecord>): DelegationRecord {
    return this.delegationManagement.updateDelegation(runId, callId, updates, (id) => this.getRun(id));
  }

  rollback(runId: string, options: RollbackOptions): TimelineSnapshot {
    return this.eventManagement.rollback(runId, options, (id) => this.getRun(id));
  }

  async exportRun(runId: string): Promise<string> {
    const timeline = this.getTimeline(runId);
    if (!timeline) {
      throw new Error(`run ${runId} not found`);
    }
    return this.exportService.exportRun(timeline, runId);
  }

}
