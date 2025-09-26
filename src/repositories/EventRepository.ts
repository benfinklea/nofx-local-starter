/**
 * Repository for Event entity operations
 */
import { query as pgQuery } from '../lib/db';
import { EventRow, JsonValue, IEventRepository } from './types';
import { fsRecordEvent, fsListEvents } from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class EventRepository implements IEventRepository {
  async record(
    runId: string,
    type: string,
    payload: JsonValue = {},
    stepId?: string
  ): Promise<void> {
    if (dataDriver() === 'db') {
      await pgQuery(
        `INSERT INTO nofx.event (run_id, step_id, type, payload)
         VALUES ($1, $2, $3, $4)`,
        [runId, stepId || null, type, payload]
      );
    } else {
      await fsRecordEvent(runId, type, payload, stepId);
    }
  }

  async list(runId: string): Promise<EventRow[]> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<EventRow>(
        `SELECT * FROM nofx.event
         WHERE run_id = $1
         ORDER BY created_at ASC`,
        [runId]
      );
      return result.rows;
    }
    return fsListEvents(runId);
  }
}