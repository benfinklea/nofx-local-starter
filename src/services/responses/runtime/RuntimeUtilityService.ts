/**
 * Runtime Utility Service - extracted from runtime.ts
 * Handles utility operations like serialization and rollback
 */

import type { RuntimeBundle } from '../runtime';
import type { RunRecord, EventRecord, ModeratorNote, ModeratorDisposition, RollbackOptions } from '../../../shared/responses/archive';

export class RuntimeUtilityService {
  constructor(private runtime: RuntimeBundle) {}

  addResponsesModeratorNote(
    runId: string,
    note: {
      reviewer: string;
      note: string;
      disposition: ModeratorDisposition;
      recordedAt?: Date;
    }
  ): ModeratorNote {
    const created = this.runtime.archive.addModeratorNote?.(runId, note);
    if (!created) {
      throw new Error('archive does not support moderator notes');
    }
    return created;
  }

  async exportResponsesRun(runId: string): Promise<string> {
    if (!this.runtime.archive.exportRun) {
      throw new Error('archive export not supported');
    }
    return this.runtime.archive.exportRun(runId);
  }

  async rollbackResponsesRun(runId: string, options: RollbackOptions) {
    if (typeof this.runtime.archive.rollback !== 'function') {
      throw new Error('archive does not support rollback operations');
    }

    const snapshot = this.runtime.archive.rollback(runId, options);
    const maybePromise = this.runtime.coordinator.resyncFromArchive(runId);

    if (maybePromise instanceof Promise) {
      await maybePromise;
    }

    return {
      run: this.serializeRunRecordMinimal(snapshot.run),
      events: snapshot.events.map(this.serializeEventRecordMinimal),
    };
  }

  serializeRunRecordMinimal(run: RunRecord) {
    return {
      runId: run.runId,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      model: run.request?.model,
      metadata: run.metadata ?? {},
      traceId: run.traceId,
    };
  }

  serializeEventRecordMinimal(event: EventRecord) {
    return {
      sequence: event.sequence,
      type: event.type,
      payload: event.payload,
      occurredAt: event.occurredAt.toISOString(),
    };
  }
}