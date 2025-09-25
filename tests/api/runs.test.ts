// Import test helpers first
import { callHandler, factories, resetMocks } from './utils/testHelpers';

// Create mock store
const mockStore = {
  getRun: jest.fn(),
  createRun: jest.fn(),
  listRuns: jest.fn(),
  listStepsByRun: jest.fn(),
  listArtifactsByRun: jest.fn(),
  listEvents: jest.fn(),
  listGatesByRun: jest.fn(),
  createOrGetGate: jest.fn(),
  updateGate: jest.fn(),
  resetStep: jest.fn(),
  resetRun: jest.fn(),
  inboxDelete: jest.fn(),
  listSteps: jest.fn(),
};

// Create mock buildPlanFromPrompt function
const mockBuildPlanFromPrompt = jest.fn();

// Mock dependencies BEFORE importing handlers
jest.mock('../../src/lib/store', () => ({
  store: mockStore,
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  RUN_PLAN_TOPIC: 'run-plan',
  STEP_READY_TOPIC: 'step-ready',
}));

jest.mock('../../src/lib/auth', () => ({
  isAdmin: () => true,
}));

jest.mock('../../src/lib/observability', () => ({
  setContext: jest.fn(),
}));

jest.mock('../../src/api/planBuilder', () => ({
  buildPlanFromPrompt: mockBuildPlanFromPrompt,
}));

jest.mock('../../src/lib/runRecovery', () => ({
  retryStep: jest.fn().mockResolvedValue(undefined),
  StepNotFoundError: class StepNotFoundError extends Error {
    constructor() {
      super('step_not_found');
    }
  },
}));

// NOW import handlers after all mocks are set up
import runsHandler from '../../api/runs/index';
import runDetailsHandler from '../../api/runs/[id]/index';
import runPreviewHandler from '../../api/runs/preview';
import runRerunHandler from '../../api/runs/[id]/rerun';
import runStreamHandler from '../../api/runs/[id]/stream';
import runTimelineHandler from '../../api/runs/[id]/timeline';
import runGatesHandler from '../../api/runs/[id]/gates';
import stepRetryHandler from '../../api/runs/[id]/steps/[stepId]/retry';

describe('Runs API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
    // Reset and configure buildPlanFromPrompt mock
    mockBuildPlanFromPrompt.mockReset();
    mockBuildPlanFromPrompt.mockResolvedValue({
      goal: 'Test',
      steps: [{ name: 'test', tool: 'test' }],
    });
  });

  describe('GET /api/runs', () => {
    it('should list runs', async () => {
      const mockRuns = [factories.run(), factories.run({ id: 'run-456' })];
      mockStore.listRuns.mockResolvedValue(mockRuns);

      const response = await callHandler(runsHandler, {
        method: 'GET',
        query: { limit: '50' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({ runs: mockRuns });
      expect(mockStore.listRuns).toHaveBeenCalledWith(50, undefined);
    });

    it('should filter runs by projectId', async () => {
      mockStore.listRuns.mockResolvedValue([]);

      const response = await callHandler(runsHandler, {
        method: 'GET',
        query: { projectId: 'project-123', limit: '10' },
      });

      expect(response.status).toBe(200);
      expect(mockStore.listRuns).toHaveBeenCalledWith(10, 'project-123');
    });

    it('should handle errors when listing runs', async () => {
      mockStore.listRuns.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runsHandler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });
  });

  describe('POST /api/runs', () => {
    it('should create a new run', async () => {
      const mockRun = factories.run();
      mockStore.createRun.mockResolvedValue(mockRun);

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          plan: { steps: [{ name: 'test', tool: 'test' }] },
          projectId: 'project-123',
        },
      });

      expect(response.status).toBe(201);
      expect(response.json).toMatchObject({ id: 'run-123' });
      expect(mockStore.createRun).toHaveBeenCalled();
    });

    it('should handle standard mode with prompt', async () => {
      const mockRun = factories.run();
      mockStore.createRun.mockResolvedValue(mockRun);

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
            quality: true,
          },
        },
      });

      expect(response.status).toBe(201);
    });

    it('should reject invalid plan data', async () => {
      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it('should handle standard build errors', async () => {
      mockBuildPlanFromPrompt.mockImplementation(() => {
        throw new Error('Build failed');
      });

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
          },
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'Build failed' });
    });

    it('should handle non-Error exceptions in standard build', async () => {
      mockBuildPlanFromPrompt.mockImplementation(() => {
        throw 'String error';
      });

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
          },
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'bad standard request' });
    });

    it('should handle run creation errors', async () => {
      mockStore.createRun.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          plan: { steps: [{ type: 'test' }] },
        },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions in run creation', async () => {
      mockStore.createRun.mockRejectedValue('String error');

      const response = await callHandler(runsHandler, {
        method: 'POST',
        body: {
          plan: { steps: [{ type: 'test' }] },
        },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'failed to create run' });
    });
  });

  describe('GET /api/runs/[id]', () => {
    it('should get run details with steps and artifacts', async () => {
      const mockRun = factories.run();
      const mockSteps = [factories.step()];
      const mockArtifacts: any[] = [];

      mockStore.getRun.mockResolvedValue(mockRun);
      mockStore.listStepsByRun.mockResolvedValue(mockSteps);
      mockStore.listArtifactsByRun.mockResolvedValue(mockArtifacts);

      const response = await callHandler(runDetailsHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual({
        run: mockRun,
        steps: mockSteps,
        artifacts: mockArtifacts,
      });
    });

    it('should return 404 for non-existent run', async () => {
      mockStore.getRun.mockResolvedValue(null);

      const response = await callHandler(runDetailsHandler, {
        method: 'GET',
        query: { id: 'non-existent' },
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'not found' });
    });

    it('should handle database errors', async () => {
      mockStore.getRun.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runDetailsHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions', async () => {
      mockStore.getRun.mockRejectedValue('String error');

      const response = await callHandler(runDetailsHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to get run details' });
    });
  });

  describe('POST /api/runs/preview', () => {
    it('should preview a run plan', async () => {
      const response = await callHandler(runPreviewHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
            quality: true,
          },
        },
      });

      expect(response.status).toBe(200);
      expect(response.json).toHaveProperty('steps');
      expect(response.json).toHaveProperty('plan');
      expect(mockBuildPlanFromPrompt).toHaveBeenCalledWith(
        'Test prompt',
        expect.objectContaining({ quality: true })
      );
    });

    it('should reject missing standard field', async () => {
      const response = await callHandler(runPreviewHandler, {
        method: 'POST',
        body: {},
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'missing standard' });
    });

    it('should handle build errors', async () => {
      mockBuildPlanFromPrompt.mockImplementation(() => {
        throw new Error('Failed to build plan');
      });

      const response = await callHandler(runPreviewHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
          },
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'Failed to build plan' });
    });

    it('should handle non-Error exceptions in build', async () => {
      mockBuildPlanFromPrompt.mockImplementation(() => {
        throw 'String error';
      });

      const response = await callHandler(runPreviewHandler, {
        method: 'POST',
        body: {
          standard: {
            prompt: 'Test prompt',
          },
        },
      });

      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: 'failed to preview' });
    });
  });

  describe('POST /api/runs/[id]/rerun', () => {
    it('should create a rerun of an existing run', async () => {
      const mockOriginalRun = factories.run();
      const mockNewRun = factories.run({ id: 'run-new' });

      mockStore.getRun.mockResolvedValue(mockOriginalRun);
      mockStore.createRun.mockResolvedValue(mockNewRun);

      const response = await callHandler(runRerunHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toMatchObject({
        id: 'run-new',
        originalRunId: 'run-123',
      });
    });

    it('should return 404 for non-existent run', async () => {
      mockStore.getRun.mockResolvedValue(null);

      const response = await callHandler(runRerunHandler, {
        method: 'POST',
        query: { id: 'non-existent' },
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'Run not found' });
    });

    it('should handle rerun creation errors', async () => {
      const mockOriginalRun = factories.run();
      mockStore.getRun.mockResolvedValue(mockOriginalRun);
      mockStore.createRun.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runRerunHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions in rerun', async () => {
      const mockOriginalRun = factories.run();
      mockStore.getRun.mockResolvedValue(mockOriginalRun);
      mockStore.createRun.mockRejectedValue('String error');

      const response = await callHandler(runRerunHandler, {
        method: 'POST',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to create rerun' });
    });
  });

  describe('GET /api/runs/[id]/timeline', () => {
    it('should get timeline events', async () => {
      const mockEvents = [
        { event: 'run.created', timestamp: new Date().toISOString() },
        { event: 'step.started', timestamp: new Date().toISOString() },
      ];

      mockStore.listEvents.mockResolvedValue(mockEvents);

      const response = await callHandler(runTimelineHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(mockEvents);
    });

    it('should handle timeline fetch errors', async () => {
      mockStore.listEvents.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runTimelineHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions in timeline', async () => {
      mockStore.listEvents.mockRejectedValue('String error');

      const response = await callHandler(runTimelineHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to get timeline' });
    });
  });

  describe('GET /api/runs/[id]/gates', () => {
    it('should list gates for a run', async () => {
      const mockGates = [factories.gate()];
      mockStore.listGatesByRun.mockResolvedValue(mockGates);

      const response = await callHandler(runGatesHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(200);
      expect(response.json).toEqual(mockGates);
    });

    it('should handle gates fetch errors', async () => {
      mockStore.listGatesByRun.mockRejectedValue(new Error('Database error'));

      const response = await callHandler(runGatesHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Database error' });
    });

    it('should handle non-Error exceptions in gates', async () => {
      mockStore.listGatesByRun.mockRejectedValue('String error');

      const response = await callHandler(runGatesHandler, {
        method: 'GET',
        query: { id: 'run-123' },
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Failed to list gates' });
    });
  });

  describe('POST /api/runs/[id]/steps/[stepId]/retry', () => {
    it('should retry a step', async () => {
      const { retryStep } = require('../../src/lib/runRecovery');
      retryStep.mockResolvedValue(undefined);

      const response = await callHandler(stepRetryHandler, {
        method: 'POST',
        query: { id: 'run-123', stepId: 'step-123' },
      });

      expect(response.status).toBe(202);
      expect(response.json).toEqual({ ok: true });
      expect(retryStep).toHaveBeenCalledWith('run-123', 'step-123');
    });

    it('should require authentication', async () => {
      // Temporarily mock isAdmin to return false
      const authModule = require('../../src/lib/auth');
      authModule.isAdmin = jest.fn().mockReturnValue(false);

      const response = await callHandler(stepRetryHandler, {
        method: 'POST',
        query: { id: 'run-123', stepId: 'step-123' },
        authenticated: false,
      });

      // Restore the mock
      authModule.isAdmin = jest.fn().mockReturnValue(true);

      expect(response.status).toBe(401);
    });

    it('should handle step not found error', async () => {
      // Set up authenticated user
      const authModule = require('../../src/lib/auth');
      authModule.isAdmin = jest.fn().mockReturnValue(true);

      const { retryStep, StepNotFoundError } = require('../../src/lib/runRecovery');
      retryStep.mockRejectedValue(new StepNotFoundError('Step not found'));

      const response = await callHandler(stepRetryHandler, {
        method: 'POST',
        query: { id: 'run-123', stepId: 'step-456' },
        authenticated: true,
      });

      expect(response.status).toBe(404);
      expect(response.json).toEqual({ error: 'step not found' });
    });

    it('should handle retry errors', async () => {
      // Set up authenticated user
      const authModule = require('../../src/lib/auth');
      authModule.isAdmin = jest.fn().mockReturnValue(true);

      const { retryStep } = require('../../src/lib/runRecovery');
      retryStep.mockRejectedValue(new Error('Retry failed'));

      const response = await callHandler(stepRetryHandler, {
        method: 'POST',
        query: { id: 'run-123', stepId: 'step-123' },
        authenticated: true,
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'Retry failed' });
    });

    it('should handle non-Error exceptions in retry', async () => {
      // Set up authenticated user
      const authModule = require('../../src/lib/auth');
      authModule.isAdmin = jest.fn().mockReturnValue(true);

      const { retryStep } = require('../../src/lib/runRecovery');
      retryStep.mockRejectedValue('String error');

      const response = await callHandler(stepRetryHandler, {
        method: 'POST',
        query: { id: 'run-123', stepId: 'step-123' },
        authenticated: true,
      });

      expect(response.status).toBe(500);
      expect(response.json).toEqual({ error: 'failed to retry step' });
    });
  });
});