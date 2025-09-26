/**
 * Repository for Outbox entity operations
 */
import { query as pgQuery } from '../lib/db';
import { OutboxRow, JsonValue, IOutboxRepository } from './types';
import {
  fsOutboxAdd,
  fsOutboxListUnsent,
  fsOutboxMarkSent
} from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class OutboxRepository implements IOutboxRepository {
  async add(topic: string, payload: JsonValue): Promise<void> {
    if (dataDriver() === 'db') {
      await pgQuery(
        `INSERT INTO nofx.outbox (topic, payload)
         VALUES ($1, $2)`,
        [topic, payload]
      );
    } else {
      await fsOutboxAdd(topic, payload);
    }
  }

  async listUnsent(limit: number = 50): Promise<OutboxRow[]> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<OutboxRow>(
        `SELECT id, topic, payload, sent, created_at
         FROM nofx.outbox
         WHERE sent = false
         ORDER BY created_at ASC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    }
    return fsOutboxListUnsent(limit);
  }

  async markSent(id: string): Promise<void> {
    if (dataDriver() === 'db') {
      await pgQuery(
        `UPDATE nofx.outbox
         SET sent = true, sent_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else {
      await fsOutboxMarkSent(id);
    }
  }
}