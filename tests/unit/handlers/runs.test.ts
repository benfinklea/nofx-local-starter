/**
 * Comprehensive unit tests for runs handler functions
 * Target: 90%+ coverage for src/api/server/handlers/runs.ts
 */

import { Request, Response } from 'express';
import {
  handleRunPreview,
  handleCreateRun,
  handleGetRun,
  handleGetRunTimeline,
  handleRunStream,
  handleListRuns,
  handleRetryStep,
} from '../../../src/api/server/handlers/runs';
import { store } from '../../../src/lib/store';
import * as queue from '../../../src/lib/queue';
import * as events from '../../../src/lib/events';
import * as logger from '../../../src/lib/logger';
import * as observability from '../../../src/lib/observability';
import * as runRecovery from '../../../src/lib/runRecovery';
import * as traceLogger from '../../../src/lib/traceLogger';
import * as planBuilder from '../../../src/api/planBuilder';

// Mock all dependencies
jest.mock('../../../src/lib/store');
jest.mock('../../../src/lib/queue');
jest.mock('../../../src/lib/events');
jest.mock('../../../src/lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../../src/lib/observability', () => ({
  setContext: jest.fn(),
}));
jest.mock('../../../src/lib/runRecovery', () => ({
  retryStep: jest.fn(),
  StepNotFoundError: class StepNotFoundError extends Error {
    constructor() {
      super('Step not found');
      this.name = 'StepNotFoundError';
    }
  },
  StepNotRetryableError: class StepNotRetryableError extends Error {
    constructor() {
      super('Step not retryable');
      this.name = 'StepNotRetryableError';
    }
  },
}));
jest.mock('../../../src/lib/traceLogger', () => ({
  trace: jest.fn(),
}));
jest.mock('../../../src/api/planBuilder');
jest.mock('../../../src/lib/json', () => ({
  toJsonObject: jest.fn((obj) => obj || {}),
}));
jest.mock('../../../src/worker/runner', () => ({
  runStep: jest.fn().mockResolvedValue(undefined),
}));

const mockStore = store as jest.Mocked<typeof store>;
const mockQueue = queue as jest.Mocked<typeof queue>;
const mockEvents = events as jest.Mocked<typeof events>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockObservability = observability as jest.Mocked<typeof observability>;
const mockRunRecovery = runRecovery as jest.Mocked<typeof runRecovery>;
const mockTraceLogger = traceLogger as jest.Mocked<typeof traceLogger>;
const mockPlanBuilder = planBuilder as jest.Mocked<typeof planBuilder>;

describe('Runs Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let writeHeadMock: jest.Mock;
  let writeMock: jest.Mock;
  let onMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup response mocks
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    writeHeadMock = jest.fn();
    writeMock = jest.fn();
    onMock = jest.fn();

    mockRes = {
      json: jsonMock,
      status: statusMock,
      writeHead: writeHeadMock,
      write: writeMock,
    };

    mockReq = {
      body: {},
      params: {},
      query: {},
      headers: {},
      userId: 'user-123',
      userTier: 'free',
      on: onMock,
    };

    // Default mocks
    (mockTraceLogger.trace as jest.Mock).mockImplementation(() => {});
    (mockLogger.log.error as jest.Mock).mockImplementation(() => {});
    (mockObservability.setContext as jest.Mock).mockImplementation(() => {});
    (mockEvents.recordEvent as jest.Mock).mockResolvedValue(undefined);
    (mockQueue.enqueue as jest.Mock).mockResolvedValue(undefined);
    (mockQueue.getOldestAgeMs as jest.Mock).mockReturnValue(null);
    (mockQueue.hasSubscribers as jest.Mock).mockReturnValue(false);
  });

  describe('handleRunPreview', () => {
    it('should generate preview for standard mode with prompt', async () => {
      const mockPlan = {
        goal: 'test goal',
        steps: [{ name: 'step1', tool: 'bash', inputs: {} }],
      };

      (mockPlanBuilder.buildPlanFromPrompt as jest.Mock).mockResolvedValue(mockPlan);

      mockReq.body = {
        standard: {
          prompt: 'Create a test feature',
          quality: true,
          projectId: 'proj-123',
        },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(mockPlanBuilder.buildPlanFromPrompt).toHaveBeenCalledWith('Create a test feature', {
        quality: true,
        openPr: false,
        filePath: undefined,
        summarizeQuery: undefined,
        summarizeTarget: undefined,
        projectId: 'proj-123',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(mockPlan);
    });

    it('should return 400 if standard mode missing prompt', async () => {
      mockReq.body = {
        standard: { projectId: 'proj-123' },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing or invalid prompt in standard mode' });
    });

    it('should return 400 if standard field missing', async () => {
      mockReq.body = {};

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'missing standard' });
    });

    it('should handle plan builder errors', async () => {
      (mockPlanBuilder.buildPlanFromPrompt as jest.Mock).mockRejectedValue(
        new Error('Plan generation failed')
      );

      mockReq.body = {
        standard: { prompt: 'test', projectId: 'proj-123' },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Plan generation failed' });
    });

    it('should handle non-Error exceptions', async () => {
      (mockPlanBuilder.buildPlanFromPrompt as jest.Mock).mockRejectedValue('string error');

      mockReq.body = {
        standard: { prompt: 'test', projectId: 'proj-123' },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'failed to preview' });
    });

    it('should handle all optional parameters', async () => {
      const mockPlan = { goal: 'test', steps: [] };
      (mockPlanBuilder.buildPlanFromPrompt as jest.Mock).mockResolvedValue(mockPlan);

      mockReq.body = {
        standard: {
          prompt: 'test',
          quality: true,
          openPr: true,
          filePath: '/test/file.ts',
          summarizeQuery: 'query',
          summarizeTarget: 'target',
          projectId: 'proj-123',
        },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(mockPlanBuilder.buildPlanFromPrompt).toHaveBeenCalledWith('test', {
        quality: true,
        openPr: true,
        filePath: '/test/file.ts',
        summarizeQuery: 'query',
        summarizeTarget: 'target',
        projectId: 'proj-123',
      });
    });
  });

  describe('handleCreateRun', () => {
    const mockPlan = {
      goal: 'test',
      steps: [
        { name: 'step1', tool: 'bash', inputs: { command: 'echo test' } },
      ],
    };

    const mockRun = {
      id: 'run-123',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    beforeEach(() => {
      (mockStore.createRun as jest.Mock).mockResolvedValue(mockRun);
      (mockStore.createStep as jest.Mock).mockResolvedValue({ id: 'step-123' });
      (mockStore.getStep as jest.Mock).mockResolvedValue({ id: 'step-123', status: 'pending' });
    });

    it('should create run in standard mode', async () => {
      (mockPlanBuilder.buildPlanFromPrompt as jest.Mock).mockResolvedValue(mockPlan);

      mockReq.body = {
        standard: {
          prompt: 'test prompt',
          projectId: 'proj-123',
        },
      };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockPlanBuilder.buildPlanFromPrompt).toHaveBeenCalled();
      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          metadata: {
            created_by: 'user-123',
            tier: 'free',
          },
        }),
        'proj-123'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        id: 'run-123',
        status: 'queued',
        projectId: 'proj-123',
      });
    });

    it('should create run in direct plan mode', async () => {
      mockReq.body = {
        plan: mockPlan,
        projectId: 'proj-456',
      };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockPlanBuilder.buildPlanFromPrompt).not.toHaveBeenCalled();
      expect(mockStore.createRun).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should use x-project-id header if not in body', async () => {
      mockReq.body = { plan: mockPlan };
      mockReq.headers = { 'x-project-id': 'header-proj' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.anything(),
        'header-proj'
      );
    });

    it('should default to "default" project if no projectId', async () => {
      mockReq.body = { plan: mockPlan };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.anything(),
        'default'
      );
    });

    it('should return 400 for invalid plan schema', async () => {
      mockReq.body = {
        plan: { invalid: 'structure' },
      };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(Object),
      }));
    });

    it('should handle missing prompt in standard mode', async () => {
      mockReq.body = {
        standard: { projectId: 'proj-123' },
      };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing or invalid prompt in standard mode',
      });
    });

    it('should process steps and enqueue them', async () => {
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStore.createStep).toHaveBeenCalled();
      expect(mockQueue.enqueue).toHaveBeenCalled();
      expect(mockEvents.recordEvent).toHaveBeenCalledWith(
        'run-123',
        'run.created',
        expect.any(Object)
      );
    });

    it('should handle steps with security policy', async () => {
      const planWithPolicy = {
        goal: 'test',
        steps: [{
          name: 'step1',
          tool: 'bash',
          inputs: { command: 'test' },
          tools_allowed: ['bash'],
          env_allowed: ['PATH'],
          secrets_scope: 'project',
        }],
      };

      mockReq.body = { plan: planWithPolicy, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStore.createStep).toHaveBeenCalledWith(
        'run-123',
        'step1',
        'bash',
        expect.objectContaining({
          command: 'test',
          _policy: expect.objectContaining({
            tools_allowed: ['bash'],
            env_allowed: ['PATH'],
            secrets_scope: 'project',
          }),
        }),
        expect.any(String)
      );
    });

    it('should skip already succeeded steps', async () => {
      (mockStore.createStep as jest.Mock).mockResolvedValue({
        id: 'step-123',
        status: 'succeeded',
      });

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should skip cancelled steps', async () => {
      (mockStore.createStep as jest.Mock).mockResolvedValue({
        id: 'step-123',
        status: 'cancelled',
      });

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should handle backpressure with queue age', async () => {
      (mockQueue.getOldestAgeMs as jest.Mock).mockReturnValue(8000);
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        queue.STEP_READY_TOPIC,
        expect.any(Object),
        expect.objectContaining({ delay: expect.any(Number) })
      );
    });

    it('should handle inline execution for memory queue', async () => {
      process.env.QUEUE_DRIVER = 'memory';
      (mockQueue.hasSubscribers as jest.Mock).mockReturnValue(false);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify inline execution was attempted
      expect(mockQueue.hasSubscribers).toHaveBeenCalled();

      delete process.env.QUEUE_DRIVER;
    });

    it('should handle step creation errors gracefully', async () => {
      (mockStore.createStep as jest.Mock).mockRejectedValue(new Error('DB error'));
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still return 201 as run was created
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(mockLogger.log.error).toHaveBeenCalled();
    });

    it('should handle step without id from createStep', async () => {
      (mockStore.createStep as jest.Mock).mockResolvedValue(null);
      (mockStore.getStepByIdempotencyKey as jest.Mock) = jest.fn().mockResolvedValue({ id: 'step-from-key' });

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should skip step if no step id can be resolved', async () => {
      (mockStore.createStep as jest.Mock).mockResolvedValue(null);
      (mockStore.getStepByIdempotencyKey as jest.Mock) = jest.fn().mockResolvedValue(null);
      (mockStore.getStep as jest.Mock).mockResolvedValue(null);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should record backpressure event when queue age exceeds threshold', async () => {
      process.env.BACKPRESSURE_AGE_MS = '3000';
      (mockQueue.getOldestAgeMs as jest.Mock).mockReturnValue(10000);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEvents.recordEvent).toHaveBeenCalledWith(
        'run-123',
        'queue.backpressure',
        expect.objectContaining({ ageMs: 10000, delayMs: expect.any(Number) }),
        'step-123'
      );

      delete process.env.BACKPRESSURE_AGE_MS;
    });

    it('should handle inline execution disabled', async () => {
      process.env.DISABLE_INLINE_RUNNER = '1';
      process.env.QUEUE_DRIVER = 'memory';
      (mockQueue.hasSubscribers as jest.Mock).mockReturnValue(false);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not attempt inline execution
      const { runStep } = require('../../../src/worker/runner');
      expect(runStep).not.toHaveBeenCalled();

      delete process.env.DISABLE_INLINE_RUNNER;
      delete process.env.QUEUE_DRIVER;
    });

    it('should not run inline when queue has subscribers', async () => {
      process.env.QUEUE_DRIVER = 'memory';
      (mockQueue.hasSubscribers as jest.Mock).mockReturnValue(true);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const { runStep } = require('../../../src/worker/runner');
      expect(runStep).not.toHaveBeenCalled();

      delete process.env.QUEUE_DRIVER;
    });

    it('should handle inline execution errors', async () => {
      const { runStep } = require('../../../src/worker/runner');
      (runStep as jest.Mock).mockRejectedValue(new Error('Inline execution failed'));

      process.env.QUEUE_DRIVER = 'memory';
      (mockQueue.hasSubscribers as jest.Mock).mockReturnValue(false);

      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-123', stepId: 'step-123' }),
        'Inline step execution failed'
      );

      delete process.env.QUEUE_DRIVER;
    });

    it('should handle store.createRun errors', async () => {
      (mockStore.createRun as jest.Mock).mockRejectedValue(new Error('DB error'));
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to create run' });
    });

    it('should handle missing user context', async () => {
      mockReq.userId = undefined;
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockStore.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: '',
          metadata: {
            created_by: '',
            tier: 'free',
          },
        }),
        'proj-123'
      );
    });
  });

  describe('handleGetRun', () => {
    it('should return run successfully', async () => {
      const mockRun = { id: 'run-123', status: 'completed' };
      (mockStore.getRun as jest.Mock).mockResolvedValue(mockRun);

      mockReq.params = { id: 'run-123' };

      await handleGetRun(mockReq as Request, mockRes as Response);

      expect(mockStore.getRun).toHaveBeenCalledWith('run-123');
      expect(jsonMock).toHaveBeenCalledWith(mockRun);
    });

    it('should return 404 when run not found', async () => {
      (mockStore.getRun as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleGetRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should handle store errors', async () => {
      (mockStore.getRun as jest.Mock).mockRejectedValue(new Error('DB error'));

      mockReq.params = { id: 'run-123' };

      await handleGetRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to retrieve run' });
      expect(mockLogger.log.error).toHaveBeenCalled();
    });
  });

  describe('handleGetRunTimeline', () => {
    it('should return timeline successfully', async () => {
      const mockRun = { id: 'run-123', status: 'completed' };
      const mockTimeline = [
        { timestamp: '2024-01-01', event: 'run.created' },
      ];

      (mockStore.getRun as jest.Mock).mockResolvedValue(mockRun);
      // Add getRunTimeline to the mocked store object
      Object.assign(mockStore, { getRunTimeline: jest.fn().mockResolvedValue(mockTimeline) });

      mockReq.params = { id: 'run-123' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ timeline: mockTimeline });
    });

    it('should return 404 when run not found', async () => {
      (mockStore.getRun as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should return empty timeline if method not available', async () => {
      const mockRun = { id: 'run-123', status: 'completed' };
      (mockStore.getRun as jest.Mock).mockResolvedValue(mockRun);
      delete (mockStore as any).getRunTimeline;

      mockReq.params = { id: 'run-123' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ timeline: [] });
    });

    it('should handle errors', async () => {
      (mockStore.getRun as jest.Mock).mockRejectedValue(new Error('DB error'));

      mockReq.params = { id: 'run-123' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to retrieve timeline' });
    });
  });

  describe('handleRunStream', () => {
    it('should setup SSE connection', async () => {
      const mockRun = { id: 'run-123', status: 'running' };
      (mockStore.getRun as jest.Mock).mockResolvedValue(mockRun);

      mockReq.params = { id: 'run-123' };

      await handleRunStream(mockReq as Request, mockRes as Response);

      expect(writeHeadMock).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }));
      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('connected'));
    });

    it('should return 404 when run not found', async () => {
      (mockStore.getRun as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleRunStream(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should handle errors', async () => {
      (mockStore.getRun as jest.Mock).mockRejectedValue(new Error('DB error'));

      mockReq.params = { id: 'run-123' };

      await handleRunStream(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to setup stream' });
    });
  });

  describe('handleListRuns', () => {
    it('should list runs with pagination', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'completed' },
        { id: 'run-2', status: 'running' },
      ];

      (mockStore.listRuns as jest.Mock).mockResolvedValue({
        runs: mockRuns,
        total: 2,
      });

      mockReq.query = { page: '1', limit: '20' };

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        runs: mockRuns,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1,
        },
      });
    });

    it('should handle array return from store', async () => {
      const mockRuns = [{ id: 'run-1' }];
      (mockStore.listRuns as jest.Mock).mockResolvedValue(mockRuns);

      mockReq.query = {};

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        runs: mockRuns,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      });
    });

    it('should enforce max limit of 100', async () => {
      (mockStore.listRuns as jest.Mock).mockResolvedValue({ runs: [], total: 0 });

      mockReq.query = { limit: '200' };

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(mockStore.listRuns).toHaveBeenCalledWith(100);
    });

    it('should handle invalid page/limit values', async () => {
      (mockStore.listRuns as jest.Mock).mockResolvedValue({ runs: [], total: 0 });

      mockReq.query = { page: 'invalid', limit: '-5' };

      await handleListRuns(mockReq as Request, mockRes as Response);

      // Invalid values result in Math.max(1, NaN) = 1 for limit
      expect(mockStore.listRuns).toHaveBeenCalledWith(1);
    });

    it('should handle errors', async () => {
      (mockStore.listRuns as jest.Mock).mockRejectedValue(new Error('DB error'));

      mockReq.query = {};

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to list runs' });
    });
  });

  describe('handleRetryStep', () => {
    it('should retry step successfully', async () => {
      (mockRunRecovery.retryStep as jest.Mock).mockResolvedValue(undefined);

      mockReq.params = { runId: 'run-123', stepId: 'step-456' };

      await handleRetryStep(mockReq as Request, mockRes as Response);

      expect(mockRunRecovery.retryStep).toHaveBeenCalledWith('run-123', 'step-456');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Step retry initiated',
      });
    });

    it('should return 404 for StepNotFoundError', async () => {
      (mockRunRecovery.retryStep as jest.Mock).mockRejectedValue(
        new mockRunRecovery.StepNotFoundError()
      );

      mockReq.params = { runId: 'run-123', stepId: 'nonexistent' };

      await handleRetryStep(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Step not found' });
    });

    it('should return 400 for StepNotRetryableError', async () => {
      (mockRunRecovery.retryStep as jest.Mock).mockRejectedValue(
        new mockRunRecovery.StepNotRetryableError()
      );

      mockReq.params = { runId: 'run-123', stepId: 'step-456' };

      await handleRetryStep(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Step cannot be retried' });
    });

    it('should handle other errors', async () => {
      (mockRunRecovery.retryStep as jest.Mock).mockRejectedValue(new Error('Retry failed'));

      mockReq.params = { runId: 'run-123', stepId: 'step-456' };

      await handleRetryStep(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to retry step' });
      expect(mockLogger.log.error).toHaveBeenCalled();
    });
  });
});
