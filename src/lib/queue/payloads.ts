/**
 * Type-safe queue payload definitions using discriminated unions
 *
 * This file defines all queue payload types and provides type-safe
 * queue operations through mapped types and discriminated unions.
 *
 * Each payload type includes a `type` discriminant field for runtime type checking
 * and compile-time type narrowing.
 */

import type { QueuePayload } from './types';

/**
 * Payload for step ready events
 */
export interface StepReadyPayload extends QueuePayload {
  type: 'step.ready';
  runId: string;
  stepId: string;
  idempotencyKey: string;
  __attempt: number;
}

/**
 * Payload for step failed events
 */
export interface StepFailedPayload extends QueuePayload {
  type: 'step.failed';
  runId: string;
  stepId: string;
  error: string;
  attempts: number;
  canRetry: boolean;
}

/**
 * Payload for run completed events
 */
export interface RunCompletedPayload extends QueuePayload {
  type: 'run.completed';
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  duration: number;
  completedAt: number;
}

/**
 * Payload for run cancelled events
 */
export interface RunCancelledPayload extends QueuePayload {
  type: 'run.cancelled';
  runId: string;
  cancelledBy: string;
  reason?: string;
}

/**
 * Payload for artifact generated events
 */
export interface ArtifactGeneratedPayload extends QueuePayload {
  type: 'artifact.generated';
  runId: string;
  stepId: string;
  artifactId: string;
  artifactPath: string;
  artifactType: string;
}

/**
 * Payload for gate approval required events
 */
export interface GateApprovalRequiredPayload extends QueuePayload {
  type: 'gate.approval_required';
  runId: string;
  stepId: string;
  gateId: string;
  gateType: string;
  approvalData: unknown;
}

/**
 * Discriminated union of all queue payload types
 *
 * The `type` field acts as a discriminant, enabling type narrowing:
 *
 * @example
 * ```typescript
 * function handlePayload(payload: QueueEventPayload) {
 *   switch (payload.type) {
 *     case 'step.ready':
 *       // TypeScript knows payload is StepReadyPayload
 *       console.log(payload.stepId, payload.__attempt);
 *       break;
 *     case 'run.completed':
 *       // TypeScript knows payload is RunCompletedPayload
 *       console.log(payload.status, payload.duration);
 *       break;
 *   }
 * }
 * ```
 */
export type QueueEventPayload =
  | StepReadyPayload
  | StepFailedPayload
  | RunCompletedPayload
  | RunCancelledPayload
  | ArtifactGeneratedPayload
  | GateApprovalRequiredPayload;

/**
 * Mapping of queue topics to their payload types
 * This provides compile-time type safety for queue operations
 */
export interface QueueTopicPayloadMap {
  'step.ready': StepReadyPayload;
  'step.failed': StepFailedPayload;
  'step.dlq': StepReadyPayload; // DLQ uses same payload as step.ready
  'run.completed': RunCompletedPayload;
  'run.cancelled': RunCancelledPayload;
  'artifact.generated': ArtifactGeneratedPayload;
  'gate.approval_required': GateApprovalRequiredPayload;
}

/**
 * Union type of all valid queue topics
 */
export type QueueTopic = keyof QueueTopicPayloadMap;

/**
 * Get the payload type for a specific topic
 */
export type PayloadForTopic<T extends QueueTopic> = QueueTopicPayloadMap[T];

// ============================================================================
// Type Guards Using Discriminated Union
// ============================================================================

/**
 * Type guard to check if value is a valid queue event payload
 *
 * @param value - The value to check
 * @returns true if value is a valid QueueEventPayload
 */
export function isQueueEventPayload(value: unknown): value is QueueEventPayload {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const type = (value as { type: string }).type;
  return (
    type === 'step.ready' ||
    type === 'step.failed' ||
    type === 'run.completed' ||
    type === 'run.cancelled' ||
    type === 'artifact.generated' ||
    type === 'gate.approval_required'
  );
}

/**
 * Type guard for StepReadyPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is StepReadyPayload
 */
export function isStepReadyPayload(value: unknown): value is StepReadyPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'step.ready' &&
    'runId' in value &&
    'stepId' in value &&
    'idempotencyKey' in value &&
    '__attempt' in value &&
    typeof (value as StepReadyPayload).runId === 'string' &&
    typeof (value as StepReadyPayload).stepId === 'string' &&
    typeof (value as StepReadyPayload).idempotencyKey === 'string' &&
    typeof (value as StepReadyPayload).__attempt === 'number'
  );
}

/**
 * Type guard for StepFailedPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is StepFailedPayload
 */
export function isStepFailedPayload(value: unknown): value is StepFailedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'step.failed' &&
    'runId' in value &&
    'stepId' in value &&
    'error' in value &&
    'attempts' in value &&
    'canRetry' in value &&
    typeof (value as StepFailedPayload).runId === 'string' &&
    typeof (value as StepFailedPayload).stepId === 'string' &&
    typeof (value as StepFailedPayload).error === 'string' &&
    typeof (value as StepFailedPayload).attempts === 'number' &&
    typeof (value as StepFailedPayload).canRetry === 'boolean'
  );
}

/**
 * Type guard for RunCompletedPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is RunCompletedPayload
 */
export function isRunCompletedPayload(value: unknown): value is RunCompletedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'run.completed' &&
    'runId' in value &&
    'status' in value &&
    'duration' in value &&
    typeof (value as RunCompletedPayload).runId === 'string' &&
    ['succeeded', 'failed', 'cancelled'].includes((value as RunCompletedPayload).status) &&
    typeof (value as RunCompletedPayload).duration === 'number'
  );
}

/**
 * Type guard for RunCancelledPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is RunCancelledPayload
 */
export function isRunCancelledPayload(value: unknown): value is RunCancelledPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'run.cancelled' &&
    'runId' in value &&
    'cancelledBy' in value &&
    typeof (value as RunCancelledPayload).runId === 'string' &&
    typeof (value as RunCancelledPayload).cancelledBy === 'string'
  );
}

/**
 * Type guard for ArtifactGeneratedPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is ArtifactGeneratedPayload
 */
export function isArtifactGeneratedPayload(value: unknown): value is ArtifactGeneratedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'artifact.generated' &&
    'runId' in value &&
    'stepId' in value &&
    'artifactId' in value &&
    'artifactPath' in value &&
    'artifactType' in value &&
    typeof (value as ArtifactGeneratedPayload).runId === 'string' &&
    typeof (value as ArtifactGeneratedPayload).stepId === 'string' &&
    typeof (value as ArtifactGeneratedPayload).artifactId === 'string' &&
    typeof (value as ArtifactGeneratedPayload).artifactPath === 'string' &&
    typeof (value as ArtifactGeneratedPayload).artifactType === 'string'
  );
}

/**
 * Type guard for GateApprovalRequiredPayload using discriminated union
 *
 * @param value - The payload to check
 * @returns true if value is GateApprovalRequiredPayload
 */
export function isGateApprovalRequiredPayload(value: unknown): value is GateApprovalRequiredPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: string }).type === 'gate.approval_required' &&
    'runId' in value &&
    'stepId' in value &&
    'gateId' in value &&
    'gateType' in value &&
    typeof (value as GateApprovalRequiredPayload).runId === 'string' &&
    typeof (value as GateApprovalRequiredPayload).stepId === 'string' &&
    typeof (value as GateApprovalRequiredPayload).gateId === 'string' &&
    typeof (value as GateApprovalRequiredPayload).gateType === 'string'
  );
}
