/**
 * Comprehensive unit tests for runs handler functions
 * Target: 90%+ coverage for src/api/server/handlers/runs/RunController.ts
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
import * as queue from '../../../src/lib/queue';
import * as logger from '../../../src/lib/logger';
import * as runRecovery from '../../../src/lib/runRecovery';
import * as traceLogger from '../../../src/lib/traceLogger';

// Mock all dependencies
jest.mock('../../../src/lib/queue', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  hasSubscribers: jest.fn().mockReturnValue(false),
  getOldestAgeMs: jest.fn().mockReturnValue(null),
  subscribe: jest.fn(),
  getCounts: jest.fn().mockResolvedValue({}),
  listDlq: jest.fn().mockResolvedValue([]),
  rehydrateDlq: jest.fn().mockResolvedValue(0),
  // Export constants that tests can use
  STEP_READY_TOPIC: 'step.ready',
  OUTBOX_TOPIC: 'event.out',
  STEP_DLQ_TOPIC: 'step.dlq',
}));
jest.mock('../../../src/lib/logger', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
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
    constructor(status: string) {
      super(`step_not_retryable:${status}`);
      this.name = 'StepNotRetryableError';
    }
  },
}));
jest.mock('../../../src/lib/traceLogger', () => ({
  trace: jest.fn(),
}));

// Mock the RunCoordinator
jest.mock('../../../src/api/server/handlers/runs/RunCoordinator', () => {
  return {
    RunCoordinator: jest.fn().mockImplementation(() => {
      return {
        buildPlanFromStandardMode: jest.fn(),
        createRun: jest.fn(),
        processStepsAsync: jest.fn().mockResolvedValue(undefined),
        getRun: jest.fn(),
        getRunTimeline: jest.fn(),
        listRuns: jest.fn(),
      };
    }),
  };
});

const mockQueue = queue as jest.Mocked<typeof queue>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockRunRecovery = runRecovery as jest.Mocked<typeof runRecovery>;
const mockTraceLogger = traceLogger as jest.Mocked<typeof traceLogger>;

// Get the mocked constructor
const { RunCoordinator } = require('../../../src/api/server/handlers/runs/RunCoordinator');

describe('Runs Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let writeHeadMock: jest.Mock;
  let writeMock: jest.Mock;
  let onMock: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCoordinator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup response mocks
    jsonMock = jest.fn();
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

    // Setup coordinator mock
    mockCoordinator = {
      buildPlanFromStandardMode: jest.fn(),
      createRun: jest.fn(),
      processStepsAsync: jest.fn().mockResolvedValue(undefined),
      getRun: jest.fn(),
      getRunTimeline: jest.fn(),
      listRuns: jest.fn(),
    };

    RunCoordinator.mockImplementation(() => mockCoordinator);

    // Default mocks
    (mockTraceLogger.trace as jest.Mock).mockImplementation(() => {});
    (mockLogger.log.error as jest.Mock).mockImplementation(() => {});
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

      mockCoordinator.buildPlanFromStandardMode.mockResolvedValue(mockPlan);

      mockReq.body = {
        standard: {
          prompt: 'Create a test feature',
          quality: true,
          projectId: 'proj-123',
        },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(mockCoordinator.buildPlanFromStandardMode).toHaveBeenCalledWith({
        prompt: 'Create a test feature',
        quality: true,
        openPr: undefined,
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
      mockCoordinator.buildPlanFromStandardMode.mockRejectedValue(
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
      mockCoordinator.buildPlanFromStandardMode.mockRejectedValue('string error');

      mockReq.body = {
        standard: { prompt: 'test', projectId: 'proj-123' },
      };

      await handleRunPreview(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'failed to preview' });
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
      mockCoordinator.createRun.mockResolvedValue(mockRun);
      mockCoordinator.buildPlanFromStandardMode.mockResolvedValue(mockPlan);
    });

    it('should create run in standard mode', async () => {
      mockReq.body = {
        standard: {
          prompt: 'test prompt',
        },
        projectId: 'proj-123',
      };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(mockCoordinator.buildPlanFromStandardMode).toHaveBeenCalled();
      expect(mockCoordinator.createRun).toHaveBeenCalledWith({
        plan: mockPlan,
        projectId: 'proj-123',
        userId: 'user-123',
        userTier: 'free',
      });
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

      expect(mockCoordinator.buildPlanFromStandardMode).not.toHaveBeenCalled();
      expect(mockCoordinator.createRun).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
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

    it('should handle creation errors', async () => {
      mockCoordinator.createRun.mockRejectedValue(new Error('DB error'));
      mockReq.body = { plan: mockPlan, projectId: 'proj-123' };

      await handleCreateRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to create run' });
    });
  });

  describe('handleGetRun', () => {
    it('should return run successfully', async () => {
      const mockRun = { id: 'run-123', status: 'completed' };
      mockCoordinator.getRun.mockResolvedValue(mockRun);

      mockReq.params = { id: 'run-123' };

      await handleGetRun(mockReq as Request, mockRes as Response);

      expect(mockCoordinator.getRun).toHaveBeenCalledWith('run-123');
      expect(jsonMock).toHaveBeenCalledWith(mockRun);
    });

    it('should return 404 when run not found', async () => {
      mockCoordinator.getRun.mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleGetRun(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should handle errors', async () => {
      mockCoordinator.getRun.mockRejectedValue(new Error('DB error'));

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

      mockCoordinator.getRun.mockResolvedValue(mockRun);
      mockCoordinator.getRunTimeline.mockResolvedValue(mockTimeline);

      mockReq.params = { id: 'run-123' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ timeline: mockTimeline });
    });

    it('should return 404 when run not found', async () => {
      mockCoordinator.getRun.mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should handle errors', async () => {
      mockCoordinator.getRun.mockRejectedValue(new Error('DB error'));

      mockReq.params = { id: 'run-123' };

      await handleGetRunTimeline(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to retrieve timeline' });
    });
  });

  describe('handleRunStream', () => {
    it('should setup SSE connection', async () => {
      const mockRun = { id: 'run-123', status: 'running' };
      mockCoordinator.getRun.mockResolvedValue(mockRun);

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
      mockCoordinator.getRun.mockResolvedValue(null);

      mockReq.params = { id: 'nonexistent' };

      await handleRunStream(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Run not found' });
    });

    it('should handle errors', async () => {
      mockCoordinator.getRun.mockRejectedValue(new Error('DB error'));

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

      mockCoordinator.listRuns.mockResolvedValue(mockRuns);

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

    it('should handle empty results', async () => {
      mockCoordinator.listRuns.mockResolvedValue([]);

      mockReq.query = {};

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        runs: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        },
      });
    });

    it('should enforce max limit of 100', async () => {
      mockCoordinator.listRuns.mockResolvedValue([]);

      mockReq.query = { limit: '200' };

      await handleListRuns(mockReq as Request, mockRes as Response);

      expect(mockCoordinator.listRuns).toHaveBeenCalledWith(100);
    });

    it('should handle invalid page/limit values', async () => {
      mockCoordinator.listRuns.mockResolvedValue([]);

      mockReq.query = { page: 'invalid', limit: '-5' };

      await handleListRuns(mockReq as Request, mockRes as Response);

      // Invalid values result in Math.max(1, NaN) = 1 for limit
      expect(mockCoordinator.listRuns).toHaveBeenCalledWith(1);
    });

    it('should handle errors', async () => {
      mockCoordinator.listRuns.mockRejectedValue(new Error('DB error'));

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
        new mockRunRecovery.StepNotRetryableError('pending')
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
