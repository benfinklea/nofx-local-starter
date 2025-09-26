/**
 * Repository for Artifact entity operations
 */
import { query as pgQuery } from '../lib/db';
import { ArtifactWithStepName, JsonValue, IArtifactRepository } from './types';
import { fsAddArtifact, fsListArtifactsByRun } from '../adapters/FilesystemAdapter';
import { dataDriver } from '../lib/config';

export class ArtifactRepository implements IArtifactRepository {
  async add(
    stepId: string,
    type: string,
    path: string,
    metadata?: JsonValue
  ): Promise<void> {
    if (dataDriver() === 'db') {
      await pgQuery(
        `INSERT INTO nofx.artifact (step_id, type, path, metadata)
         VALUES ($1, $2, $3, $4)`,
        [stepId, type, path, metadata || {}]
      );
    } else {
      await fsAddArtifact(stepId, type, path, metadata);
    }
  }

  async listByRun(runId: string): Promise<ArtifactWithStepName[]> {
    if (dataDriver() === 'db') {
      const result = await pgQuery<ArtifactWithStepName>(
        `SELECT a.id, a.step_id, a.type, a.path, a.metadata,
                a.created_at, s.name AS step_name
         FROM nofx.artifact a
         JOIN nofx.step s ON s.id = a.step_id
         WHERE s.run_id = $1
         ORDER BY a.created_at ASC`,
        [runId]
      );
      return result.rows;
    }
    return fsListArtifactsByRun(runId);
  }
}