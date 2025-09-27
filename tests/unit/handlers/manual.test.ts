/**
 * Tests for manual handler
 * Provides coverage for manual gate workflow functionality
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn(),
    getLatestGate: jest.fn(),
    createOrGetGate: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step_ready'
}));

import manualHandler from '../../../src/worker/handlers/manual';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { enqueue } from '../../../src/lib/queue';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockEnqueue = jest.mocked(enqueue);

describe('manual handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockEnqueue.mockResolvedValue(undefined);
    mockStore.createOrGetGate.mockResolvedValue({} as any);
  });

  describe('match', () => {
    it('should match tools starting with manual:', () => {
      expect(manualHandler.match('manual:approve')).toBe(true);
      expect(manualHandler.match('manual:review')).toBe(true);
      expect(manualHandler.match('manual:')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(manualHandler.match('bash')).toBe(false);
      expect(manualHandler.match('gate')).toBe(false);
      expect(manualHandler.match('test:manual')).toBe(false);
      expect(manualHandler.match('manualabc')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'manual-approval',
      tool: 'manual:approve',
      inputs: { description: 'Approve deployment' }
    };

    it('should create a new gate when none exists', async () => {
      mockStore.getLatestGate.mockResolvedValue(null);

      await manualHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should update step to running
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should create gate
      expect(mockStore.createOrGetGate).toHaveBeenCalledWith('run-123', 'step-123', 'manual:approve');

      // Should record gate created event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'gate.created',
        { stepId: 'step-123', tool: 'manual:approve' },
        'step-123'
      );

      // Should re-enqueue with delay
      expect(mockEnqueue).toHaveBeenCalledWith(
        'step_ready',
        { runId: 'run-123', stepId: 'step-123' },
        { delay: 5000 }
      );

      // Should record waiting event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'gate.waiting',
        { stepId: 'step-123', delayMs: 5000 },
        'step-123'
      );
    });

    it('should wait when gate is pending', async () => {
      mockStore.getLatestGate.mockResolvedValue({
        id: 'gate-456',
        run_id: 'run-456',
        step_id: 'step-123',
        gate_type: 'manual:approve',
        status: 'pending',
        created_at: new Date().toISOString()
      } as any);

      await manualHandler.run({
        runId: 'run-456',
        step: baseStep as any
      });

      // Should not create a new gate
      expect(mockStore.createOrGetGate).not.toHaveBeenCalled();

      // Should re-enqueue with delay
      expect(mockEnqueue).toHaveBeenCalledWith(
        'step_ready',
        { runId: 'run-456', stepId: 'step-123' },
        { delay: 5000 }
      );

      // Should record waiting event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'gate.waiting',
        { stepId: 'step-123', delayMs: 5000 },
        'step-123'
      );
    });

    it('should succeed when gate is passed', async () => {
      mockStore.getLatestGate.mockResolvedValue({
        id: 'gate-789',
        run_id: 'run-789',
        step_id: 'step-123',
        gate_type: 'manual:approve',
        status: 'passed',
        created_at: new Date().toISOString()
      } as any);

      await manualHandler.run({
        runId: 'run-789',
        step: baseStep as any
      });

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          manual: true,
          gateId: 'gate-789',
          status: 'passed'
        }
      });

      // Should record finished event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-789',
        'step.finished',
        {
          stepId: 'step-123',
          tool: 'manual:approve',
          manual: true,
          gateId: 'gate-789'
        },
        'step-123'
      );

      // Should not re-enqueue
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('should succeed when gate is waived', async () => {
      mockStore.getLatestGate.mockResolvedValue({
        id: 'gate-waived',
        run_id: 'run-waived',
        step_id: 'step-123',
        gate_type: 'manual:approve',
        status: 'waived',
        created_at: new Date().toISOString()
      } as any);

      await manualHandler.run({
        runId: 'run-waived',
        step: baseStep as any
      });

      // Should update step to succeeded
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          manual: true,
          gateId: 'gate-waived',
          status: 'waived'
        }
      });

      // Should record finished event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-waived',
        'step.finished',
        {
          stepId: 'step-123',
          tool: 'manual:approve',
          manual: true,
          gateId: 'gate-waived'
        },
        'step-123'
      );
    });

    it('should fail when gate is failed', async () => {
      mockStore.getLatestGate.mockResolvedValue({
        id: 'gate-failed',
        run_id: 'run-failed',
        step_id: 'step-123',
        gate_type: 'manual:approve',
        status: 'failed',
        created_at: new Date().toISOString()
      } as any);

      await expect(manualHandler.run({
        runId: 'run-failed',
        step: baseStep as any
      })).rejects.toThrow('manual gate failed');

      // Should update step to failed
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        ended_at: expect.any(String),
        outputs: {
          manual: true,
          gateId: 'gate-failed',
          status: 'failed'
        }
      });

      // Should record failed event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-failed',
        'step.failed',
        {
          stepId: 'step-123',
          tool: 'manual:approve',
          manual: true,
          gateId: 'gate-failed'
        },
        'step-123'
      );
    });

    it('should handle different manual tool variants', async () => {
      mockStore.getLatestGate.mockResolvedValue(null);

      const customStep = {
        id: 'step-custom',
        name: 'custom-review',
        tool: 'manual:custom_approval',
        inputs: { reason: 'Custom deployment approval' }
      };

      await manualHandler.run({
        runId: 'run-custom',
        step: customStep as any
      });

      expect(mockStore.createOrGetGate).toHaveBeenCalledWith('run-custom', 'step-custom', 'manual:custom_approval');
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-custom',
        'gate.created',
        { stepId: 'step-custom', tool: 'manual:custom_approval' },
        'step-custom'
      );
    });

    it('should always update step to running first', async () => {
      mockStore.getLatestGate.mockResolvedValue({
        id: 'gate-existing',
        run_id: 'run-running',
        step_id: 'step-123',
        gate_type: 'manual:approve',
        status: 'passed',
        created_at: new Date().toISOString()
      } as any);

      await manualHandler.run({
        runId: 'run-running',
        step: baseStep as any
      });

      // Should always call updateStep first with running status
      expect(mockStore.updateStep).toHaveBeenNthCalledWith(1, 'step-123', {
        status: 'running',
        started_at: expect.any(String)
      });
    });
  });
});