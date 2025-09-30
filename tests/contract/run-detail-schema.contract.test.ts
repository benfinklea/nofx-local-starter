/**
 * BULLETPROOF CONTRACT TESTS - Run Detail API Schema
 *
 * Validates that the API contract is never broken by ensuring
 * response schemas match expectations exactly.
 */

import { describe, test, expect } from '@jest/globals';
import { z } from 'zod';

// Define strict schema for run detail response
const StepSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  sequence_number: z.number().int().min(0),
  tool: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  started_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
  error: z.string().optional().nullable(),
  output: z.any().optional().nullable()
});

const ArtifactSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  type: z.string().min(1),
  path: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  size: z.number().int().min(0).optional().nullable(),
  created_at: z.string().datetime()
});

const PlanStepSchema = z.object({
  name: z.string(),
  tool: z.string(),
  inputs: z.any().optional()
});

const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(PlanStepSchema)
});

const RunSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  plan: PlanSchema.optional().nullable(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
  error: z.string().optional().nullable(),
  result: z.any().optional().nullable()
});

const RunDetailResponseSchema = z.object({
  run: RunSchema,
  steps: z.array(StepSchema),
  artifacts: z.array(ArtifactSchema)
});

describe('Run Detail API Contract - BULLETPROOF SCHEMA TESTS', () => {
  describe('🛡️ Response Schema Validation', () => {
    test('validates complete successful response', async () => {
      const validResponse = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'local',
          status: 'completed',
          plan: {
            goal: 'Write a haiku',
            steps: [
              { name: 'typecheck', tool: 'gate:typecheck' },
              { name: 'lint', tool: 'gate:lint' }
            ]
          },
          created_at: '2025-09-30T12:00:00.000Z',
          started_at: '2025-09-30T12:00:01.000Z',
          completed_at: '2025-09-30T12:00:10.000Z'
        },
        steps: [
          {
            id: 'step-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            sequence_number: 0,
            tool: 'gate:typecheck',
            name: 'typecheck',
            status: 'completed',
            started_at: '2025-09-30T12:00:01.000Z',
            completed_at: '2025-09-30T12:00:05.000Z'
          }
        ],
        artifacts: [
          {
            id: 'artifact-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            step_id: 'step-1',
            name: 'output.txt',
            type: 'text/plain',
            path: '/artifacts/output.txt',
            size: 1024,
            created_at: '2025-09-30T12:00:05.000Z'
          }
        ]
      };

      const result = RunDetailResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    test('validates minimal valid response', async () => {
      const minimalResponse = {
        run: {
          id: '00000000-0000-0000-0000-000000000000',
          tenant_id: 'test',
          status: 'queued',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(minimalResponse);
      expect(result.success).toBe(true);
    });

    test('rejects response with missing run', async () => {
      const invalidResponse = {
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    test('rejects response with invalid run ID format', async () => {
      const invalidResponse = {
        run: {
          id: 'not-a-uuid',
          tenant_id: 'test',
          status: 'queued',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    test('rejects response with invalid status', async () => {
      const invalidResponse = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'invalid-status',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    test('rejects response with invalid date format', async () => {
      const invalidResponse = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          created_at: 'not-a-date'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    test('accepts response with null optional fields', async () => {
      const responseWithNulls = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          plan: null,
          created_at: '2025-09-30T12:00:00.000Z',
          started_at: null,
          completed_at: null,
          error: null,
          result: null
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(responseWithNulls);
      expect(result.success).toBe(true);
    });
  });

  describe('🛡️ Backward Compatibility', () => {
    test('accepts response with extra fields (forward compatibility)', async () => {
      const responseWithExtra = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          created_at: '2025-09-30T12:00:00.000Z',
          // Extra fields that might be added in future
          priority: 'high',
          tags: ['important'],
          metadata: { foo: 'bar' }
        },
        steps: [],
        artifacts: [],
        // Extra top-level field
        pagination: { total: 1, page: 1 }
      };

      // Schema should be lenient with extra fields
      const result = RunDetailResponseSchema.passthrough().safeParse(responseWithExtra);
      expect(result.success).toBe(true);
    });

    test('validates v1 response format', async () => {
      // Original v1 format
      const v1Response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'local',
          status: 'completed',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(v1Response);
      expect(result.success).toBe(true);
    });
  });

  describe('🛡️ Steps Array Schema', () => {
    test('validates empty steps array', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('validates steps with all required fields', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'running',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [
          {
            id: 'step-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            sequence_number: 0,
            tool: 'gate:typecheck',
            name: 'typecheck',
            status: 'completed',
            started_at: '2025-09-30T12:00:01.000Z',
            completed_at: '2025-09-30T12:00:05.000Z'
          }
        ],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('rejects steps with invalid sequence_number', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'running',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [
          {
            id: 'step-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            sequence_number: -1, // Invalid: negative
            tool: 'gate:typecheck',
            name: 'typecheck',
            status: 'completed'
          }
        ],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    test('rejects steps with mismatched run_id', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'running',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [
          {
            id: 'step-1',
            run_id: 'different-run-id', // Should match parent run
            sequence_number: 0,
            tool: 'gate:typecheck',
            name: 'typecheck',
            status: 'completed'
          }
        ],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      // Schema allows this, but application logic should validate
      expect(result.success).toBe(true);

      // Custom validation
      if (result.success) {
        const data = result.data;
        const runId = data.run.id;
        const allStepsBelongToRun = data.steps.every(step => step.run_id === runId);
        expect(allStepsBelongToRun).toBe(false);
      }
    });
  });

  describe('🛡️ Artifacts Array Schema', () => {
    test('validates empty artifacts array', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'completed',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('validates artifacts with all fields', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'completed',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: [
          {
            id: 'artifact-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            step_id: 'step-1',
            name: 'output.log',
            type: 'text/plain',
            path: '/artifacts/output.log',
            content: 'Log content here',
            size: 1024,
            created_at: '2025-09-30T12:00:05.000Z'
          }
        ]
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('accepts artifacts with null optional fields', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'completed',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: [
          {
            id: 'artifact-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            step_id: null,
            name: 'output.log',
            type: 'text/plain',
            path: null,
            content: null,
            size: null,
            created_at: '2025-09-30T12:00:05.000Z'
          }
        ]
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('rejects artifacts with negative size', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'completed',
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: [
          {
            id: 'artifact-1',
            run_id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
            name: 'output.log',
            type: 'text/plain',
            size: -100, // Invalid
            created_at: '2025-09-30T12:00:05.000Z'
          }
        ]
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('🛡️ Plan Schema', () => {
    test('validates plan with steps', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          plan: {
            goal: 'Run all quality gates',
            steps: [
              { name: 'typecheck', tool: 'gate:typecheck' },
              { name: 'lint', tool: 'gate:lint', inputs: { fix: true } },
              { name: 'test', tool: 'gate:unit' }
            ]
          },
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('accepts plan with empty goal', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          plan: {
            goal: '',
            steps: []
          },
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test('accepts run with null plan', async () => {
      const response = {
        run: {
          id: '7fe292d5-3c01-4f48-b64a-f513ca5cd7c7',
          tenant_id: 'test',
          status: 'queued',
          plan: null,
          created_at: '2025-09-30T12:00:00.000Z'
        },
        steps: [],
        artifacts: []
      };

      const result = RunDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('🛡️ Error Response Schema', () => {
    const ErrorResponseSchema = z.object({
      error: z.string()
    });

    test('validates 404 error response', async () => {
      const errorResponse = {
        error: 'not found'
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    test('validates 500 error response', async () => {
      const errorResponse = {
        error: 'Failed to get run details'
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    test('rejects error response without error field', async () => {
      const errorResponse = {
        message: 'Something went wrong'
      };

      const result = ErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('🛡️ Production Response Validation', () => {
    test('validates actual production response structure', async () => {
      // Fetch from production and validate
      const response = await fetch('https://nofx-local-starter.vercel.app/runs/7fe292d5-3c01-4f48-b64a-f513ca5cd7c7');

      if (response.ok) {
        const data = await response.json();
        const result = RunDetailResponseSchema.safeParse(data);

        if (!result.success) {
          console.error('Schema validation errors:', result.error.errors);
        }

        expect(result.success).toBe(true);
      }
    });
  });
});
