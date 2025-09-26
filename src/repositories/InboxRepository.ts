/**
 * Repository for Inbox entity operations
 */
import { query as pgQuery } from '../lib/db';
import { IInboxRepository } from './types';
import { fsInboxMarkIfNew, fsInboxDelete } from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class InboxRepository implements IInboxRepository {
  async markIfNew(key: string): Promise<boolean> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<{ id: string }>(
        `INSERT INTO nofx.inbox (key)
         VALUES ($1)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [key]
      );
      return result.rows.length > 0;
    }
    return fsInboxMarkIfNew(key);
  }

  async delete(key: string): Promise<void> {
    if (dataDriver() === 'db') {
      await pgQuery(
        `DELETE FROM nofx.inbox WHERE key = $1`,
        [key]
      );
    } else {
      await fsInboxDelete(key);
    }
  }
}