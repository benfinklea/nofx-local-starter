/**
 * Artifact Management Service - extracted from FileSystemStore.ts
 * Handles artifact creation and retrieval
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { JsonValue, ArtifactRow, ArtifactWithStepName } from '../types';
import { FileOperationService } from './FileOperationService';

export class ArtifactManagementService {
  constructor(
    private readonly fileOps: FileOperationService,
    private readonly root: string
  ) {}

  /**
   * Create an artifact
   */
  async createArtifact(
    runId: string,
    stepId: string,
    name: string,
    type: string,
    data: JsonValue
  ): Promise<ArtifactRow> {
    const id = randomUUID();
    const created_at = new Date().toISOString();

    const artifact: ArtifactRow = {
      id,
      run_id: runId,
      step_id: stepId,
      name,
      type,
      data,
      created_at,
    };

    const artifactsDir = path.join(this.root, 'runs', runId, 'artifacts');
    this.fileOps.ensureDirSync(artifactsDir);

    const artifactPath = this.fileOps.getArtifactPath(runId, id, this.root);
    await this.fileOps.writeJsonFile(artifactPath, artifact);

    return artifact;
  }

  /**
   * List artifacts for a run
   */
  async listArtifacts(runId: string): Promise<ArtifactRow[]> {
    const artifactsDir = path.join(this.root, 'runs', runId, 'artifacts');
    this.fileOps.ensureDirSync(artifactsDir);

    const files = await this.fileOps.readDirectorySafe(artifactsDir);
    const artifacts: ArtifactRow[] = [];

    for (const f of files) {
      if (!f.endsWith('.json')) continue;

      const artifactPath = path.join(artifactsDir, f);
      const artifactData = await this.fileOps.readJsonFile(artifactPath);

      if (artifactData) {
        artifacts.push(artifactData as ArtifactRow);
      }
    }

    return artifacts;
  }

  /**
   * List artifacts with step names
   */
  async listArtifactsWithStepName(runId: string): Promise<ArtifactWithStepName[]> {
    const artifacts = await this.listArtifacts(runId);
    const stepsDir = this.fileOps.getStepsDirectory(runId, this.root);

    const results: ArtifactWithStepName[] = [];

    for (const artifact of artifacts) {
      const stepPath = path.join(stepsDir, `${artifact.step_id}.json`);
      const stepData = await this.fileOps.readJsonFile(stepPath);

      const stepName = stepData ? (stepData as any).name : 'Unknown Step';

      results.push({
        ...artifact,
        step_name: stepName,
      });
    }

    return results;
  }
}