/**
 * Type definitions for run handlers
 *
 * Centralized type definitions used across the run management modules.
 * These types support the separation of concerns between HTTP handling,
 * business logic orchestration, and step processing.
 */

import type { Plan, StepInput } from '../../../../shared/types';
import type { JsonValue, RunRow, StepRow } from '../../../../lib/store/types';

/**
 * Standard mode request parameters for building plans from prompts
 */
export interface StandardModeRequest {
  prompt: string;
  quality?: boolean;
  openPr?: boolean;
  filePath?: string;
  summarizeQuery?: string;
  summarizeTarget?: string;
  projectId?: string;
}

/**
 * Internal step preparation data used during batch processing
 */
export interface StepPreparation {
  step: StepInput;
  idemKey: string;
  inputsWithPolicy: JsonValue;
}

/**
 * Result of a step creation operation
 */
export interface StepCreationResult {
  step: StepInput;
  stepId: string | undefined;
  existing: StepRow | undefined;
  idemKey: string;
}

/**
 * Configuration for run creation
 */
export interface RunCreationConfig {
  plan: Plan;
  projectId: string;
  userId: string;
  userTier?: string;
}

/**
 * Options for step processing
 */
export interface StepProcessingOptions {
  skipEnqueue?: boolean;
  inlineExecution?: boolean;
}

/**
 * Run creation response
 */
export interface RunCreationResponse {
  id: string;
  status: string;
  projectId: string;
}

/**
 * Run list response with pagination
 */
export interface RunListResponse {
  runs: RunRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Run timeline response
 */
export interface RunTimelineResponse {
  timeline: JsonValue[];
}

/**
 * Step retry response
 */
export interface StepRetryResponse {
  success: boolean;
  message: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  correlationId?: string;
  timestamp?: string;
}
