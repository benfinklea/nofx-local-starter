/**
 * Step Management Service - extracted from FileSystemStore.ts
 * Handles step creation, retrieval, and updates
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { JsonValue, StepRow } from '../types';
import { FileOperationService } from './FileOperationService';

export class StepManagementService {
  constructor(
    private readonly fileOps: FileOperationService,
    private readonly root: string
  ) {}

  /**
   * Create a new step
   */
  async createStep(
    runId: string,
    name: string,
    tool: string,
    inputs?: JsonValue,
    idempotencyKey?: string
  ): Promise<StepRow | undefined> {
    const id = randomUUID();
    const created_at = new Date().toISOString();

    // Check for existing step with idempotency key
    if (idempotencyKey) {
      const existing = await this.findStepByIdempotencyKey(runId, idempotencyKey);
      if (existing) return existing;
    }

    const step: StepRow = {
      id,
      run_id: runId,
      name,
      tool,
      inputs: inputs ?? {},
      status: 'queued',
      created_at,
      started_at: null,
      ended_at: null,
      outputs: null,
      idempotency_key: idempotencyKey || null,
    };

    const stepsDir = this.fileOps.getStepsDirectory(runId, this.root);
    this.fileOps.ensureDirSync(stepsDir);

    const stepPath = this.fileOps.getStepPath(runId, id, this.root);
    await this.fileOps.writeJsonFile(stepPath, step as unknown as JsonValue);

    return step;
  }

  /**
   * Get a step by ID
   */
  async getStep(id: string): Promise<StepRow | undefined> {
    // Search all runs' steps
    const runsDir = path.join(this.root, 'runs');
    this.fileOps.ensureDirSync(runsDir);

    const runDirs = await this.fileOps.readDirectorySafe(runsDir);

    for (const runId of runDirs) {
      if (runId === 'index.json') continue;

      const stepPath = this.fileOps.getStepPath(runId, id, this.root);
      const stepData = await this.fileOps.readJsonFile(stepPath);

      if (stepData) {
        return stepData as unknown as StepRow;
      }
    }

    return undefined;
  }

  /**
   * Get step by idempotency key
   */
  async getStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
    return this.findStepByIdempotencyKey(runId, key);
  }

  /**
   * Update a step
   */
  async updateStep(id: string, patch: Partial<StepRow>): Promise<void> {
    const runsDir = path.join(this.root, 'runs');
    this.fileOps.ensureDirSync(runsDir);

    const runDirs = await this.fileOps.readDirectorySafe(runsDir);

    for (const runId of runDirs) {
      if (runId === 'index.json') continue;

      const stepPath = this.fileOps.getStepPath(runId, id, this.root);
      const stepData = await this.fileOps.readJsonFile(stepPath);

      if (stepData) {
        const updatedStep = { ...(stepData as object), ...patch };
        await this.fileOps.writeJsonFile(stepPath, updatedStep as unknown as JsonValue);
        return;
      }
    }

    throw new Error(`Step ${id} not found`);
  }

  /**
   * List steps by run ID
   */
  async listStepsByRun(runId: string): Promise<StepRow[]> {
    const stepsDir = this.fileOps.getStepsDirectory(runId, this.root);
    this.fileOps.ensureDirSync(stepsDir);

    const files = await this.fileOps.readDirectorySafe(stepsDir);
    const steps: StepRow[] = [];

    for (const f of files) {
      if (!f.endsWith('.json')) continue;

      const stepPath = path.join(stepsDir, f);
      const stepData = await this.fileOps.readJsonFile(stepPath);

      if (stepData) {
        steps.push(stepData as unknown as StepRow);
      }
    }

    // Sort by created_at ascending (chronological order)
    steps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return steps;
  }

  /**
   * Find step by idempotency key (private helper)
   */
  private async findStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
    const stepsDir = this.fileOps.getStepsDirectory(runId, this.root);
    this.fileOps.ensureDirSync(stepsDir);

    const files = await this.fileOps.readDirectorySafe(stepsDir);

    for (const f of files) {
      const stepPath = path.join(stepsDir, f);
      const stepData = await this.fileOps.readJsonFile(stepPath);

      if (stepData) {
        const step = stepData as unknown as StepRow;
        if (step.idempotency_key === key) {
          return step;
        }
      }
    }

    return undefined;
  }
}