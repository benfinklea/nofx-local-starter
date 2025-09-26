/**
 * Refactored Store - Facade for all repository operations
 * This replaces the original 625-line store.ts with a clean architecture
 */
import { RunRepository } from '../repositories/RunRepository';
import { StepRepository } from '../repositories/StepRepository';
import { EventRepository } from '../repositories/EventRepository';
import { GateRepository } from '../repositories/GateRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { InboxRepository } from '../repositories/InboxRepository';
import { OutboxRepository } from '../repositories/OutboxRepository';
import { randomUUID } from 'node:crypto';
import { query as pgQuery } from './db';
import type {
  RunRow,
  StepRow,
  EventRow,
  GateRow,
  ArtifactRow,
  ArtifactWithStepName,
  InboxRow,
  OutboxRow,
  RunSummaryRow,
  JsonValue,
  RunStatus,
  StepStatus,
  GateStatus
} from '../repositories/types';

// Initialize repositories
const runRepo = new RunRepository();
const stepRepo = new StepRepository();
const eventRepo = new EventRepository();
const gateRepo = new GateRepository();
const artifactRepo = new ArtifactRepository();
const inboxRepo = new InboxRepository();
const outboxRepo = new OutboxRepository();

/**
 * Store facade - maintains backward compatibility with existing code
 * while using the new repository pattern internally
 */
export const store = {
  // Run operations
  createRun: async (plan: JsonValue, projectId: string = 'default'): Promise<RunRow> => {
    return runRepo.create(plan, projectId);
  },

  getRun: async (id: string): Promise<RunRow | undefined> => {
    return runRepo.get(id);
  },

  updateRun: async (id: string, patch: Partial<RunRow>): Promise<void> => {
    return runRepo.update(id, patch);
  },

  listRuns: async (limit: number = 50, projectId?: string): Promise<RunSummaryRow[]> => {
    return runRepo.list(limit, projectId);
  },

  listRunsByUser: async (userId: string, limit: number = 50, projectId?: string): Promise<RunRow[]> => {
    return runRepo.listByUser(userId, limit, projectId);
  },

  resetRun: async (runId: string): Promise<void> => {
    return runRepo.reset(runId);
  },

  getUserRole: async (userId: string): Promise<string | null> => {
    return runRepo.getUserRole(userId);
  },

  // Step operations
  createStep: async (
    runId: string,
    name: string,
    tool: string,
    inputs?: JsonValue,
    idempotencyKey?: string
  ): Promise<StepRow | undefined> => {
    return stepRepo.create(runId, name, tool, inputs, idempotencyKey);
  },

  getStep: async (id: string): Promise<StepRow | undefined> => {
    return stepRepo.get(id);
  },

  getStepByIdempotencyKey: async (runId: string, key: string): Promise<StepRow | undefined> => {
    return stepRepo.getByIdempotencyKey(runId, key);
  },

  updateStep: async (id: string, patch: Partial<StepRow>): Promise<void> => {
    return stepRepo.update(id, patch);
  },

  listStepsByRun: async (runId: string): Promise<StepRow[]> => {
    return stepRepo.listByRun(runId);
  },

  countRemainingSteps: async (runId: string): Promise<number> => {
    return stepRepo.countRemaining(runId);
  },

  resetStep: async (stepId: string): Promise<void> => {
    return stepRepo.reset(stepId);
  },

  // Event operations
  recordEvent: async (
    runId: string,
    type: string,
    payload: JsonValue = {},
    stepId?: string
  ): Promise<void> => {
    return eventRepo.record(runId, type, payload, stepId);
  },

  listEvents: async (runId: string): Promise<EventRow[]> => {
    return eventRepo.list(runId);
  },

  // Gate operations
  createOrGetGate: async (
    runId: string,
    stepId: string,
    gateType: string
  ): Promise<GateRow | undefined> => {
    return gateRepo.createOrGet(runId, stepId, gateType);
  },

  getLatestGate: async (runId: string, stepId: string): Promise<GateRow | undefined> => {
    return gateRepo.getLatest(runId, stepId);
  },

  updateGate: async (gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void> => {
    return gateRepo.update(gateId, patch);
  },

  listGatesByRun: async (runId: string): Promise<GateRow[]> => {
    return gateRepo.listByRun(runId);
  },

  // Artifact operations
  addArtifact: async (
    stepId: string,
    type: string,
    path: string,
    metadata?: JsonValue
  ): Promise<void> => {
    return artifactRepo.add(stepId, type, path, metadata);
  },

  listArtifactsByRun: async (runId: string): Promise<ArtifactWithStepName[]> => {
    return artifactRepo.listByRun(runId);
  },

  // Inbox operations
  inboxMarkIfNew: async (key: string): Promise<boolean> => {
    return inboxRepo.markIfNew(key);
  },

  inboxDelete: async (key: string): Promise<void> => {
    return inboxRepo.delete(key);
  },

  // Outbox operations
  outboxAdd: async (topic: string, payload: JsonValue): Promise<void> => {
    return outboxRepo.add(topic, payload);
  },

  outboxListUnsent: async (limit: number = 50): Promise<OutboxRow[]> => {
    return outboxRepo.listUnsent(limit);
  },

  outboxMarkSent: async (id: string): Promise<void> => {
    return outboxRepo.markSent(id);
  },

  // Special method for creating run with user (backward compatibility)
  createRunWithUser: async (plan: JsonValue, projectId: string, userId: string): Promise<RunRow> => {
    const runId = randomUUID();
    const runData = {
      id: runId,
      plan,
      status: 'queued' as RunStatus,
      project_id: projectId,
      user_id: userId,
      metadata: (plan as any).metadata || {}
    };

    await pgQuery(
      `INSERT INTO nofx.run (id, plan, status, project_id, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runData.id, runData.plan, runData.status, runData.project_id, runData.user_id, runData.metadata]
    );

    const result = await pgQuery<RunRow>(`SELECT * FROM nofx.run WHERE id = $1`, [runId]);
    return result.rows[0];
  },

  // Backward compatibility method
  driver: (): string => {
    return process.env.DATA_DRIVER || 'filesystem';
  }
};

// Export types for backward compatibility
export type {
  RunRow,
  StepRow,
  EventRow,
  GateRow,
  ArtifactRow,
  ArtifactWithStepName,
  OutboxRow,
  InboxRow,
  RunSummaryRow,
  JsonValue,
  RunStatus,
  StepStatus,
  GateStatus
} from '../repositories/types';