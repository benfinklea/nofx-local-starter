/**
 * Run Management Service - extracted from archiveStore.ts
 * Handles core run operations (CRUD)
 */

import { validateResponsesRequest, responsesResultSchema } from '../../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../../shared/openai/responsesSchemas';
import type { RunRecord, SafetySnapshot, DelegationRecord } from '../../../shared/responses/archive';
import { FileManagerService } from './FileManagerService';
import { SerializationService, type SerializableRun } from './SerializationService';

export class RunManagementService {
  constructor(
    private readonly fileManager: FileManagerService,
    private readonly serialization: SerializationService,
  ) {}

  startRun(input: {
    runId: string;
    request: ResponsesRequest | unknown;
    conversationId?: string;
    metadata?: Record<string, string>;
    traceId?: string;
    safety?: Partial<SafetySnapshot>;
    delegations?: DelegationRecord[];
  }): RunRecord {
    const dir = this.fileManager.runDir(input.runId);
    if (this.fileManager.fileExists(dir)) {
      const runPath = this.fileManager.runFile(input.runId);
      if (this.fileManager.fileExists(runPath)) {
        throw new Error(`run ${input.runId} already exists`);
      }
    }
    this.fileManager.ensureDir(dir);

    const request = validateResponsesRequest(input.request);
    const now = new Date();
    const record: RunRecord = {
      runId: input.runId,
      request,
      conversationId: input.conversationId,
      metadata: input.metadata,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      traceId: input.traceId,
      safety: input.safety
        ? {
            hashedIdentifier: input.safety.hashedIdentifier,
            refusalCount: input.safety.refusalCount ?? 0,
            lastRefusalAt: input.safety.lastRefusalAt,
            moderatorNotes: input.safety.moderatorNotes ?? [],
          }
        : undefined,
      delegations: input.delegations ? input.delegations.map((d) => this.serialization.deserializeDelegation(this.serialization.serializeDelegation(d))) : [],
    };

    this.fileManager.writeJSON(this.fileManager.runFile(input.runId), this.serialization.serializeRun(record));
    this.fileManager.writeJSON(this.fileManager.eventsFile(input.runId), []);

    return record;
  }

  updateStatus(input: { runId: string; status: RunRecord['status']; result?: ResponsesResult | unknown }): RunRecord {
    const runPath = this.fileManager.runFile(input.runId);
    if (!this.fileManager.fileExists(runPath)) throw new Error(`run ${input.runId} not found`);

    const run = this.serialization.deserializeRun(this.fileManager.readJSON<SerializableRun>(runPath, null as unknown as SerializableRun));
    const parsedResult = input.result ? responsesResultSchema.parse(input.result) : undefined;
    const updated: RunRecord = {
      ...run,
      status: input.status,
      result: parsedResult ?? run.result,
      updatedAt: new Date(),
    };

    this.fileManager.writeJSON(runPath, this.serialization.serializeRun(updated));
    return updated;
  }

  getRun(runId: string): RunRecord | undefined {
    const runPath = this.fileManager.runFile(runId);
    if (!this.fileManager.fileExists(runPath)) return undefined;
    return this.serialization.deserializeRun(this.fileManager.readJSON<SerializableRun>(runPath, null as unknown as SerializableRun));
  }

  listRuns(): RunRecord[] {
    const entries = this.fileManager.listDirectories();
    const runs: RunRecord[] = [];
    for (const entry of entries) {
      const run = this.getRun(entry);
      if (run) runs.push(run);
    }
    return runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteRun(runId: string): void {
    const dir = this.fileManager.runDir(runId);
    this.fileManager.deleteDirectory(dir);
  }

  pruneOlderThan(cutoff: Date, coldStorageCallback?: (runId: string) => boolean): void {
    const runs = this.listRuns();
    for (const run of runs) {
      if (run.updatedAt < cutoff) {
        let moved = false;
        if (coldStorageCallback) {
          moved = coldStorageCallback(run.runId);
        }
        // If cold storage failed or wasn't configured, delete the run
        if (!moved) {
          this.deleteRun(run.runId);
        }
      }
    }
  }
}