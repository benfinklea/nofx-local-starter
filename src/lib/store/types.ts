/**
 * Type definitions for the store module
 *
 * This module provides type-safe data structures for persisting run, step, and event data
 * with proper generic constraints to ensure type safety at compile time.
 */

/**
 * JSON-serializable primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Recursive JSON value type for type-safe JSON storage
 */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Base constraint for all storable entities
 * Ensures entities have required audit fields
 */
export interface StorableEntity {
  id: string;
  created_at: string;
}

/**
 * Run lifecycle status
 */
export type RunStatus = 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed' | 'cancelled' | 'rolled_back';

/**
 * Step lifecycle status
 */
export type StepStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

/**
 * Gate approval status
 */
export type GateStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'succeeded' | 'cancelled' | 'skipped';

/**
 * Run record representing a complete workflow execution
 * Extends StorableEntity to ensure proper audit fields
 */
export interface RunRow extends StorableEntity {
  id: string;
  status: RunStatus | string;
  plan?: JsonValue | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  completed_at?: string | null;
  project_id?: string | null;
  metadata?: JsonValue | null;
}

/**
 * Step record representing a single unit of work within a run
 * Extends StorableEntity to ensure proper audit fields
 */
export interface StepRow extends StorableEntity {
  id: string;
  run_id: string;
  name: string;
  tool: string;
  inputs: JsonValue;
  outputs?: JsonValue | null;
  status: StepStatus | string;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  completed_at?: string | null;
  idempotency_key?: string | null;
}

/**
 * Event record for audit trail and state changes
 * Extends StorableEntity to ensure proper audit fields
 */
export interface EventRow extends StorableEntity {
  id: string;
  run_id: string;
  step_id?: string | null;
  type: string;
  payload: JsonValue;
  created_at: string;
}

/**
 * Gate record for quality gates and manual approvals
 * Extends StorableEntity to ensure proper audit fields
 */
export interface GateRow extends StorableEntity {
  id: string;
  run_id: string;
  step_id: string;
  gate_type: string;
  status: GateStatus | string;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
}

/**
 * Artifact record for step outputs (files, logs, etc.)
 * Extends StorableEntity to ensure proper audit fields
 */
export interface ArtifactRow extends StorableEntity {
  id: string;
  step_id: string;
  type: string;
  path: string;
  metadata?: JsonValue | null;
  created_at: string;
}

/**
 * Outbox pattern record for reliable event delivery
 * Extends StorableEntity to ensure proper audit fields
 */
export interface OutboxRow extends StorableEntity {
  id: string;
  topic: string;
  payload: JsonValue;
  sent: boolean;
  created_at: string;
}

/**
 * Lightweight run summary for list views
 * Extends StorableEntity to ensure proper audit fields
 */
export interface RunSummaryRow extends StorableEntity {
  id: string;
  status: RunStatus | string;
  created_at: string;
  title: string;
}

/**
 * Artifact record enriched with step name for easier display
 * Extends ArtifactRow with additional denormalized data
 */
export interface ArtifactWithStepName extends ArtifactRow {
  step_name?: string | null;
}

/**
 * Store driver interface for data persistence
 *
 * This interface defines the contract for all storage implementations
 * (filesystem, PostgreSQL, etc.) ensuring consistent data access patterns
 * across the application.
 *
 * All methods are designed to be idempotent where appropriate.
 *
 * @example
 * ```typescript
 * const store: StoreDriver = createFileSystemStore();
 * const run = await store.createRun({ goal: 'test', steps: [] }, 'project-123');
 * await store.updateRun(run.id, { status: 'running' });
 * ```
 */
export interface StoreDriver {
  // ============================================================================
  // Run Operations
  // ============================================================================

  /**
   * Create a new run record with initial plan
   * @param plan - The execution plan (goal + steps)
   * @param projectId - Optional project identifier
   * @returns The created run record
   */
  createRun(plan: JsonValue | null | undefined, projectId?: string): Promise<RunRow>;

  /**
   * Get a run record by ID
   * @param id - The run identifier
   * @returns The run record or undefined if not found
   */
  getRun(id: string): Promise<RunRow | undefined>;

  /**
   * Update a run record with partial data
   * @param id - The run identifier
   * @param patch - Partial run data to update
   */
  updateRun(id: string, patch: Partial<RunRow>): Promise<void>;

  /**
   * Reset a run to initial state (for retry)
   * @param id - The run identifier
   */
  resetRun(id: string): Promise<void>;

  /**
   * List runs with optional filtering
   * @param limit - Maximum number of runs to return
   * @param projectId - Optional project filter
   * @returns Array of run summaries
   */
  listRuns(limit?: number, projectId?: string): Promise<RunSummaryRow[]>;

  // ============================================================================
  // Step Operations
  // ============================================================================

  /**
   * Create a new step within a run
   * @param runId - The parent run identifier
   * @param name - Step name
   * @param tool - Tool/handler to execute
   * @param inputs - Step input data
   * @param idempotencyKey - Key to prevent duplicate execution
   * @returns The created step record or undefined if duplicate
   */
  createStep(runId: string, name: string, tool: string, inputs?: JsonValue, idempotencyKey?: string): Promise<StepRow | undefined>;

  /**
   * Get a step record by ID
   * @param id - The step identifier
   * @returns The step record or undefined if not found
   */
  getStep(id: string): Promise<StepRow | undefined>;

  /**
   * Get a step by idempotency key (for duplicate prevention)
   * @param runId - The parent run identifier
   * @param key - The idempotency key
   * @returns The step record or undefined if not found
   */
  getStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined>;

  /**
   * Update a step record with partial data
   * @param id - The step identifier
   * @param patch - Partial step data to update
   */
  updateStep(id: string, patch: Partial<StepRow>): Promise<void>;

  /**
   * Reset a step to initial state (for retry)
   * @param stepId - The step identifier
   */
  resetStep(stepId: string): Promise<void>;

  /**
   * List all steps for a run
   * @param runId - The parent run identifier
   * @returns Array of step records
   */
  listStepsByRun(runId: string): Promise<StepRow[]>;

  /**
   * Count remaining incomplete steps for a run
   * @param runId - The parent run identifier
   * @returns Number of pending/running steps
   */
  countRemainingSteps(runId: string): Promise<number>;

  // ============================================================================
  // Event Operations (Audit Trail)
  // ============================================================================

  /**
   * Record a state change event for audit trail
   * @param runId - The parent run identifier
   * @param type - Event type (e.g., 'run.created', 'step.started')
   * @param payload - Event data
   * @param stepId - Optional step identifier
   */
  recordEvent(runId: string, type: string, payload?: JsonValue, stepId?: string): Promise<void>;

  /**
   * List all events for a run
   * @param runId - The parent run identifier
   * @returns Array of event records
   */
  listEvents(runId: string): Promise<EventRow[]>;

  // ============================================================================
  // Gate Operations (Quality Gates & Approvals)
  // ============================================================================

  /**
   * Create or get existing gate for a step
   * @param runId - The parent run identifier
   * @param stepId - The step identifier
   * @param gateType - Gate type (e.g., 'manual', 'typecheck')
   * @returns The gate record
   */
  createOrGetGate(runId: string, stepId: string, gateType: string): Promise<GateRow | undefined>;

  /**
   * Get the most recent gate for a step
   * @param runId - The parent run identifier
   * @param stepId - The step identifier
   * @returns The latest gate record or undefined
   */
  getLatestGate(runId: string, stepId: string): Promise<GateRow | undefined>;

  /**
   * Update a gate record
   * @param gateId - The gate identifier
   * @param patch - Partial gate data to update (must include run_id)
   */
  updateGate(gateId: string, patch: Partial<GateRow> & { run_id: string }): Promise<void>;

  /**
   * List all gates for a run
   * @param runId - The parent run identifier
   * @returns Array of gate records
   */
  listGatesByRun(runId: string): Promise<GateRow[]>;

  // ============================================================================
  // Artifact Operations (File Storage)
  // ============================================================================

  /**
   * Add an artifact reference for a step
   * @param stepId - The parent step identifier
   * @param type - Artifact type (e.g., 'file', 'log', 'image')
   * @param path - Storage path
   * @param metadata - Optional artifact metadata
   * @returns The created artifact record or void
   */
  addArtifact(stepId: string, type: string, path: string, metadata?: JsonValue): Promise<ArtifactRow | void>;

  /**
   * List all artifacts for a run with step names
   * @param runId - The parent run identifier
   * @returns Array of artifact records with step names
   */
  listArtifactsByRun(runId: string): Promise<ArtifactWithStepName[]>;

  /**
   * Create a new artifact record
   * @param artifact - Artifact data without id and created_at
   * @returns The created artifact record
   */
  createArtifact(artifact: Omit<ArtifactRow, 'id' | 'created_at'>): Promise<ArtifactRow>;

  /**
   * Get an artifact by run, step, and filename
   * @param runId - The parent run identifier
   * @param stepId - The parent step identifier
   * @param filename - The artifact filename/path
   * @returns The artifact record or null if not found
   */
  getArtifact(runId: string, stepId: string, filename: string): Promise<ArtifactRow | null>;

  /**
   * List all artifacts for a specific step
   * @param runId - The parent run identifier
   * @param stepId - The parent step identifier
   * @returns Array of artifact records
   */
  listArtifactsByStep(runId: string, stepId: string): Promise<ArtifactRow[]>;

  /**
   * Delete a single artifact
   * @param runId - The parent run identifier
   * @param stepId - The parent step identifier
   * @param filename - The artifact filename/path
   */
  deleteArtifact(runId: string, stepId: string, filename: string): Promise<void>;

  /**
   * Delete all artifacts for a run
   * @param runId - The parent run identifier
   */
  deleteArtifactsByRun?(runId: string): Promise<void>;

  /**
   * Delete all artifacts for a step
   * @param runId - The parent run identifier
   * @param stepId - The parent step identifier
   */
  deleteArtifactsByStep?(runId: string, stepId: string): Promise<void>;

  // ============================================================================
  // Inbox Pattern (Idempotent Message Processing)
  // ============================================================================

  /**
   * Mark a message as processed if new (idempotent)
   * @param key - Unique message identifier
   * @returns true if newly marked, false if already processed
   */
  inboxMarkIfNew(key: string): Promise<boolean>;

  /**
   * Delete an inbox entry
   * @param key - Unique message identifier
   */
  inboxDelete(key: string): Promise<void>;

  // ============================================================================
  // Outbox Pattern (Reliable Event Delivery)
  // ============================================================================

  /**
   * Add an event to the outbox for delivery
   * @param topic - Event topic/destination
   * @param payload - Event data
   */
  outboxAdd(topic: string, payload: JsonValue): Promise<void>;

  /**
   * List unsent outbox messages
   * @param limit - Maximum number of messages to return
   * @returns Array of unsent outbox records
   */
  outboxListUnsent(limit?: number): Promise<OutboxRow[]>;

  /**
   * Mark an outbox message as sent
   * @param id - The outbox record identifier
   */
  outboxMarkSent(id: string): Promise<void>;

  // ============================================================================
  // Optional Enhanced Functionality
  // ============================================================================

  /**
   * Get user role for authorization (optional)
   * @param userId - The user identifier
   * @returns User role or null if not found
   */
  getUserRole?(userId: string): Promise<string | null>;

  /**
   * List runs for a specific user (optional)
   * @param userId - The user identifier
   * @param limit - Maximum number of runs to return
   * @param projectId - Optional project filter
   * @returns Array of run records
   */
  listRunsByUser?(userId: string, limit?: number, projectId?: string): Promise<RunSummaryRow[] | RunRow[]>;

  /**
   * Create a run with user context (optional)
   * @param plan - The execution plan
   * @param projectId - Project identifier
   * @param userId - User identifier
   * @returns The created run record
   */
  createRunWithUser?(plan: JsonValue, projectId: string, userId: string): Promise<RunRow>;

  /**
   * Get complete timeline of events for a run (optional)
   * @param runId - The run identifier
   * @returns Array of event records in chronological order
   */
  getRunTimeline?(runId: string): Promise<EventRow[]>;
}