/**
 * Tests for test_fail handler
 * Provides coverage for error handling in handlers
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

import testFailHandler from '../../../src/worker/handlers/test_fail';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);

describe('test_fail handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
  });

  describe('match', () => {
    it('should match test:fail tool', () => {
      expect(testFailHandler.match('test:fail')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(testFailHandler.match('test:echo')).toBe(false);
      expect(testFailHandler.match('bash')).toBe(false);
      expect(testFailHandler.match('fail')).toBe(false);
    });
  });

  describe('run', () => {
    it('should start step and then throw intentional error', async () => {
      const step = {
        id: 'step-123',
        name: 'test-fail',
        tool: 'test:fail',
        inputs: { test: 'data' }
      };

      await expect(testFailHandler.run({
        runId: 'run-123',
        step: step as any,
      })).rejects.toThrow('intentional failure for testing');

      // Should update step to running
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should record start event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.started',
        { name: 'test-fail', tool: 'test:fail' },
        'step-123'
      );

      // Should NOT have called updateStep again or recordEvent for completion
      expect(mockStore.updateStep).toHaveBeenCalledTimes(1);
      expect(mockRecordEvent).toHaveBeenCalledTimes(1);
    });

    it('should throw same error regardless of inputs', async () => {
      const step = {
        id: 'step-456',
        name: 'another-fail',
        tool: 'test:fail',
        inputs: null
      };

      await expect(testFailHandler.run({
        runId: 'run-456',
        step: step as any,
      })).rejects.toThrow('intentional failure for testing');
    });

    it('should record step started before failing', async () => {
      const step = {
        id: 'step-789',
        name: 'fail-test',
        tool: 'test:fail'
      };

      try {
        await testFailHandler.run({
          runId: 'run-789',
          step: step as any,
          });
      } catch (error) {
        // Expected to throw
      }

      // Verify the start event was recorded even though it failed
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-789',
        'step.started',
        { name: 'fail-test', tool: 'test:fail' },
        'step-789'
      );
    });
  });
});