/**
 * Safety Management Service - extracted from archiveStore.ts
 * Handles safety-related operations and moderator notes
 */

import type { RunRecord, SafetySnapshot, ModeratorNote, ModeratorNoteInput } from '../../../shared/responses/archive';
import { FileManagerService } from './FileManagerService';
import { SerializationService } from './SerializationService';

export class SafetyManagementService {
  constructor(
    private readonly fileManager: FileManagerService,
    private readonly serialization: SerializationService,
  ) {}

  updateSafety(runId: string, input: { hashedIdentifier?: string; refusalLoggedAt?: Date }, getRun: (runId: string) => RunRecord | undefined): SafetySnapshot {
    const run = getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    if (input.hashedIdentifier) {
      safety.hashedIdentifier = input.hashedIdentifier;
    }
    if (input.refusalLoggedAt) {
      safety.refusalCount = (safety.refusalCount ?? 0) + 1;
      safety.lastRefusalAt = input.refusalLoggedAt;
    }
    const updatedRun: RunRecord = {
      ...run,
      safety,
      updatedAt: new Date(),
    };
    this.fileManager.writeJSON(this.fileManager.runFile(runId), this.serialization.serializeRun(updatedRun));
    return safety;
  }

  addModeratorNote(runId: string, input: ModeratorNoteInput, getRun: (runId: string) => RunRecord | undefined): ModeratorNote {
    const run = getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const note: ModeratorNote = {
      reviewer: input.reviewer,
      note: input.note,
      disposition: input.disposition,
      recordedAt: input.recordedAt ?? new Date(),
    };
    const safety: SafetySnapshot = run.safety ?? { refusalCount: 0, moderatorNotes: [] };
    safety.moderatorNotes = [...safety.moderatorNotes, note];
    const updatedRun: RunRecord = {
      ...run,
      safety,
      updatedAt: new Date(),
    };
    this.fileManager.writeJSON(this.fileManager.runFile(runId), this.serialization.serializeRun(updatedRun));
    return note;
  }
}