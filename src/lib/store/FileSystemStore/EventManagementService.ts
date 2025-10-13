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
      payload: payload,
      created_at,
      ...(stepId && { step_id: stepId }),
    };

    // Use single events.json file (preserving original behavior)
    const eventsFile = path.join(this.root, 'runs', runId, 'events.json');
    const runDir = path.join(this.root, 'runs', runId);
    this.fileOps.ensureDirSync(runDir);

    const existingEvents = (await this.fileOps.readJsonFile(eventsFile)) as unknown as EventRow[] | null;
    const events = existingEvents && Array.isArray(existingEvents) ? existingEvents : [];
    events.push(event);

    await this.fileOps.writeJsonFile(eventsFile, events as unknown as JsonValue);
  }

  /**
   * List events for a run
   */
  async listEvents(runId: string): Promise<EventRow[]> {
    // Read from single events.json file (preserving original behavior)
    const eventsFile = path.join(this.root, 'runs', runId, 'events.json');
    const eventsData = await this.fileOps.readJsonFile(eventsFile);

    if (!eventsData || !Array.isArray(eventsData)) {
      return [];
    }

    const events = eventsData as unknown as EventRow[];

    // Sort by created_at ascending (chronological order)
    events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return events;
  }
}