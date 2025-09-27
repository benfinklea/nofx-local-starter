/**
 * Main store module entry point
 * Provides backward compatibility with the original store interface
 */

import { StoreFactory } from './StoreFactory';

export * from './types';

// Backward compatible store object with the original interface
export const store = {
  get driver() { return StoreFactory.driver; },

  // Run operations
  createRun: (plan: any, projectId = 'default') => StoreFactory.getInstance().createRun(plan, projectId),
  getRun: (id: string) => StoreFactory.getInstance().getRun(id),
  updateRun: (id: string, patch: any) => StoreFactory.getInstance().updateRun(id, patch),
  resetRun: (id: string) => StoreFactory.getInstance().resetRun(id),
  listRuns: (limit?: number, projectId?: string) => StoreFactory.getInstance().listRuns(limit, projectId),

  // Step operations
  createStep: (runId: string, name: string, tool: string, inputs?: any, idempotencyKey?: string) =>
    StoreFactory.getInstance().createStep(runId, name, tool, inputs, idempotencyKey),
  getStep: (id: string) => StoreFactory.getInstance().getStep(id),
  getStepByIdempotencyKey: (runId: string, key: string) => StoreFactory.getInstance().getStepByIdempotencyKey(runId, key),
  updateStep: (id: string, patch: any) => StoreFactory.getInstance().updateStep(id, patch),
  resetStep: (stepId: string) => StoreFactory.getInstance().resetStep(stepId),
  listStepsByRun: (runId: string) => StoreFactory.getInstance().listStepsByRun(runId),
  countRemainingSteps: (runId: string) => StoreFactory.getInstance().countRemainingSteps(runId),

  // Event operations
  recordEvent: (runId: string, type: string, payload?: any, stepId?: string) =>
    StoreFactory.getInstance().recordEvent(runId, type, payload, stepId),
  listEvents: (runId: string) => StoreFactory.getInstance().listEvents(runId),

  // Gate operations
  createOrGetGate: (runId: string, stepId: string, gateType: string) =>
    StoreFactory.getInstance().createOrGetGate(runId, stepId, gateType),
  getLatestGate: (runId: string, stepId: string) => StoreFactory.getInstance().getLatestGate(runId, stepId),
  updateGate: (gateId: string, patch: any) => StoreFactory.getInstance().updateGate(gateId, patch),
  listGatesByRun: (runId: string) => StoreFactory.getInstance().listGatesByRun(runId),

  // Artifact operations
  addArtifact: (stepId: string, type: string, path: string, metadata?: any) =>
    StoreFactory.getInstance().addArtifact(stepId, type, path, metadata),
  listArtifactsByRun: (runId: string) => StoreFactory.getInstance().listArtifactsByRun(runId),

  // Inbox operations
  inboxMarkIfNew: (key: string) => StoreFactory.getInstance().inboxMarkIfNew(key),
  inboxDelete: (key: string) => StoreFactory.getInstance().inboxDelete(key),

  // Outbox operations
  outboxAdd: (topic: string, payload: any) => StoreFactory.getInstance().outboxAdd(topic, payload),
  outboxListUnsent: (limit?: number) => StoreFactory.getInstance().outboxListUnsent(limit),
  outboxMarkSent: (id: string) => StoreFactory.getInstance().outboxMarkSent(id),

  // User operations (SaaS features)
  getUserRole: (userId: string) => {
    const instance = StoreFactory.getInstance();
    return instance.getUserRole ? instance.getUserRole(userId) : Promise.resolve(null);
  },
  listRunsByUser: (userId: string, limit?: number, projectId?: string) => {
    const instance = StoreFactory.getInstance();
    return instance.listRunsByUser ? instance.listRunsByUser(userId, limit, projectId) : instance.listRuns(limit, projectId);
  },
  createRunWithUser: (plan: any, projectId: string, userId: string) => {
    const instance = StoreFactory.getInstance();
    return instance.createRunWithUser ? instance.createRunWithUser(plan, projectId, userId) : instance.createRun(plan, projectId);
  }
};