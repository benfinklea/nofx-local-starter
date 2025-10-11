/**
 * Run Management Service - extracted from FileSystemStore.ts
 * Handles run creation, retrieval, and updates
 */

import { randomUUID } from 'node:crypto';
import type { JsonValue, RunRow, RunSummaryRow } from '../types';
import { FileOperationService } from './FileOperationService';

export class RunManagementService {
  constructor(
    private readonly fileOps: FileOperationService,
    private readonly root: string
  ) {}

  /**
   * Create a new run
   */
  async createRun(plan: JsonValue | null | undefined, _projectId = 'default'): Promise<RunRow> {
    this.fileOps.ensureDirSync(this.root);

    const id = randomUUID();
    const created_at = new Date().toISOString();
    const run: RunRow = {
      id,
      status: 'queued',
      plan: plan ?? null,
      created_at,
    };

    const runDir = this.fileOps.getRunDirectory(id, this.root);
    this.fileOps.ensureDirSync(runDir);

    const runPath = this.fileOps.getRunPath(id, this.root);
    await this.fileOps.writeJsonFile(runPath, run as unknown as JsonValue);

    // Update index
    await this.updateRunsIndex();

    return run;
  }

  /**
   * Get a run by ID
   */
  async getRun(id: string): Promise<RunRow | null> {
    const runPath = this.fileOps.getRunPath(id, this.root);
    const runData = await this.fileOps.readJsonFile(runPath);
    return (runData as unknown) as RunRow | null;
  }

  /**
   * Update a run
   */
  async updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
    const runPath = this.fileOps.getRunPath(id, this.root);
    const existingRun = await this.fileOps.readJsonFile(runPath);

    if (!existingRun) {
      throw new Error(`Run ${id} not found`);
    }

    const updatedRun = { ...(existingRun as object), ...patch };
    await this.fileOps.writeJsonFile(runPath, updatedRun as unknown as JsonValue);

    // Update index
    await this.updateRunsIndex();
  }

  /**
   * List runs with optional limit
   */
  async listRuns(limit = 20, projectId?: string): Promise<RunSummaryRow[]> {
    const runsDir = `${this.root}/runs`;
    this.fileOps.ensureDirSync(runsDir);

    const files = await this.fileOps.readDirectorySafe(runsDir);
    const runs: RunSummaryRow[] = [];

    for (const f of files) {
      if (f === 'index.json') continue;

      const runPath = this.fileOps.getRunPath(f, this.root);
      const runData = await this.fileOps.readJsonFile(runPath);

      if (runData) {
        const run = runData as unknown as RunRow;
        // Filter by projectId if provided
        if (projectId && run.project_id !== projectId) {
          continue;
        }

        // Convert to RunSummaryRow
        const summary: RunSummaryRow = {
          id: run.id,
          status: run.status,
          created_at: run.created_at,
          title: `Run ${run.id.slice(0, 8)}` // Generate a default title
        };
        runs.push(summary);
      }
    }

    // Sort by created_at descending (most recent first)
    runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return runs.slice(0, limit);
  }

  /**
   * Update runs index
   */
  private async updateRunsIndex(): Promise<void> {
    try {
      const runs = await this.listRuns(100);
      const indexPath = this.fileOps.getRunsIndexPath(this.root);
      const runsDir = `${this.root}/runs`;
      this.fileOps.ensureDirSync(runsDir);
      await this.fileOps.writeJsonFile(indexPath, runs as unknown as JsonValue);
    } catch {
      // Ignore index update errors
    }
  }
}