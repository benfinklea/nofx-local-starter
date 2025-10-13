/**
 * Delegation Management Service - extracted from archiveStore.ts
 * Handles delegation tracking and updates
 */

import type { RunRecord, DelegationRecord } from '../../../shared/responses/archive';
import { FileManagerService } from './FileManagerService';
import { SerializationService } from './SerializationService';

export class DelegationManagementService {
  constructor(
    private readonly fileManager: FileManagerService,
    private readonly serialization: SerializationService,
  ) {}

  recordDelegation(runId: string, record: DelegationRecord, getRun: (runId: string) => RunRecord | undefined): DelegationRecord {
    const run = getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const delegations = [...(run.delegations ?? [])];
    const normalized = this.serialization.deserializeDelegation(this.serialization.serializeDelegation(record));
    const index = delegations.findIndex((entry) => entry.callId === normalized.callId);
    if (index >= 0) {
      delegations.splice(index, 1, normalized);
    } else {
      delegations.push(normalized);
    }
    const updatedRun: RunRecord = {
      ...run,
      delegations,
      updatedAt: new Date(),
    };
    this.fileManager.writeJSON(this.fileManager.runFile(runId), this.serialization.serializeRun(updatedRun));
    return normalized;
  }

  updateDelegation(runId: string, callId: string, updates: Partial<DelegationRecord>, getRun: (runId: string) => RunRecord | undefined): DelegationRecord {
    const run = getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const delegations = [...(run.delegations ?? [])];
    const index = delegations.findIndex((entry) => entry.callId === callId);
    if (index < 0) throw new Error(`delegation ${callId} not found for run ${runId}`);
    const existing = delegations[index];
    if (!existing) throw new Error(`delegation ${callId} not found at index ${index} for run ${runId}`);
    const updated: DelegationRecord = {
      callId: existing.callId,
      toolName: updates.toolName ?? existing.toolName,
      status: updates.status ?? existing.status,
      arguments: updates.arguments ?? existing.arguments,
      linkedRunId: updates.linkedRunId ?? existing.linkedRunId,
      output: updates.output ?? existing.output,
      error: updates.error ?? existing.error,
      requestedAt: updates.requestedAt ? new Date(updates.requestedAt) : existing.requestedAt,
      completedAt: updates.completedAt
        ? new Date(updates.completedAt)
        : updates.status && updates.status === 'completed'
        ? new Date()
        : existing.completedAt,
    };
    const normalized = this.serialization.deserializeDelegation(this.serialization.serializeDelegation(updated));
    delegations.splice(index, 1, normalized);
    const updatedRun: RunRecord = {
      ...run,
      delegations,
      updatedAt: new Date(),
    };
    this.fileManager.writeJSON(this.fileManager.runFile(runId), this.serialization.serializeRun(updatedRun));
    return normalized;
  }
}