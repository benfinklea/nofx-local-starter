/**
 * Event Management Service - extracted from archiveStore.ts
 * Handles event recording and timeline operations
 */

import type { EventRecord, RunRecord, TimelineSnapshot, RollbackOptions } from '../../../shared/responses/archive';
import { applyRollbackToTimeline } from '../../../shared/responses/archive';
import { FileManagerService } from './FileManagerService';
import { SerializationService, type SerializableEvent } from './SerializationService';

export class EventManagementService {
  constructor(
    private readonly fileManager: FileManagerService,
    private readonly serialization: SerializationService,
  ) {}

  recordEvent(runId: string, input: { sequence?: number; type: string; payload: unknown; occurredAt?: Date }): EventRecord {
    const eventsPath = this.fileManager.eventsFile(runId);
    const events = this.fileManager.readJSON<SerializableEvent[]>(eventsPath, []);
    const lastSequence = events.length ? events[events.length - 1].sequence : 0;
    const nextSequence = input.sequence ?? lastSequence + 1;

    if (events.some((event) => event.sequence === nextSequence)) {
      throw new Error(`sequence ${nextSequence} already recorded for run ${runId}`);
    }

    const record: EventRecord = {
      runId,
      sequence: nextSequence,
      type: input.type,
      payload: input.payload,
      occurredAt: input.occurredAt ?? new Date(),
    };

    events.push(this.serialization.serializeEvent(record));
    this.fileManager.writeJSON(eventsPath, events);

    return record;
  }

  getTimeline(runId: string, getRun: (runId: string) => RunRecord | undefined): TimelineSnapshot | undefined {
    const run = getRun(runId);
    if (!run) return undefined;
    const events = this.fileManager.readJSON<SerializableEvent[]>(this.fileManager.eventsFile(runId), []);
    return {
      run,
      events: events.map((event) => this.serialization.deserializeEvent(event)),
    };
  }

  snapshotAt(runId: string, sequence: number, getRun: (runId: string) => RunRecord | undefined): TimelineSnapshot | undefined {
    const snapshot = this.getTimeline(runId, getRun);
    if (!snapshot) return undefined;
    return {
      run: snapshot.run,
      events: snapshot.events.filter((event) => event.sequence <= sequence),
    };
  }

  rollback(runId: string, options: RollbackOptions, getRun: (runId: string) => RunRecord | undefined): TimelineSnapshot {
    const run = getRun(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    const events = this.fileManager.readJSON<SerializableEvent[]>(this.fileManager.eventsFile(runId), []).map((event) => this.serialization.deserializeEvent(event));
    const { run: updatedRun, events: trimmedEvents } = applyRollbackToTimeline(run, events, options);
    this.fileManager.writeJSON(this.fileManager.runFile(runId), this.serialization.serializeRun(updatedRun));
    this.fileManager.writeJSON(this.fileManager.eventsFile(runId), trimmedEvents.map((event) => this.serialization.serializeEvent(event)));
    return {
      run: updatedRun,
      events: trimmedEvents,
    };
  }
}