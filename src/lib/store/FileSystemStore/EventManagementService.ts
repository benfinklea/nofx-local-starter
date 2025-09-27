/**
 * Event Management Service - extracted from FileSystemStore.ts
 * Handles event recording and retrieval
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { JsonValue, EventRow } from '../types';
import { FileOperationService } from './FileOperationService';

export class EventManagementService {
  constructor(
    private readonly fileOps: FileOperationService,
    private readonly root: string
  ) {}

  /**
   * Record an event
   */
  async recordEvent(
    runId: string,
    type: string,
    payload: JsonValue = {},
    stepId?: string
  ): Promise<void> {
    const id = randomUUID();
    const created_at = new Date().toISOString();

    const event: EventRow = {
      id,
      run_id: runId,
      type,
      data: payload,
      created_at,
      ...(stepId && { step_id: stepId }),
    };

    const eventsDir = this.fileOps.getEventsDirectory(runId, this.root);
    this.fileOps.ensureDirSync(eventsDir);

    const eventPath = this.fileOps.getEventPath(runId, id, this.root);
    await this.fileOps.writeJsonFile(eventPath, event);
  }

  /**
   * List events for a run
   */
  async listEvents(runId: string): Promise<EventRow[]> {
    const eventsDir = this.fileOps.getEventsDirectory(runId, this.root);
    this.fileOps.ensureDirSync(eventsDir);

    const files = await this.fileOps.readDirectorySafe(eventsDir);
    const events: EventRow[] = [];

    for (const f of files) {
      if (!f.endsWith('.json')) continue;

      const eventPath = path.join(eventsDir, f);
      const eventData = await this.fileOps.readJsonFile(eventPath);

      if (eventData) {
        events.push(eventData as EventRow);
      }
    }

    // Sort by created_at ascending (chronological order)
    events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return events;
  }
}