/**
 * Tests for test_echo handler
 * Provides coverage for basic handler functionality
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

import testEchoHandler from '../../../src/worker/handlers/test_echo';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);

describe('test_echo handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
  });

  describe('match', () => {
    it('should match test:echo tool', () => {
      expect(testEchoHandler.match('test:echo')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(testEchoHandler.match('bash')).toBe(false);
      expect(testEchoHandler.match('test:fail')).toBe(false);
      expect(testEchoHandler.match('echo')).toBe(false);
    });
  });

  describe('run', () => {
    it('should execute echo step successfully', async () => {
      const step = {
        id: 'step-123',
        name: 'test-echo',
        tool: 'test:echo',
        inputs: { message: 'hello world', data: 42 }
      };

      await testEchoHandler.run({
        runId: 'run-123',
        step: step as any,
      });

      // Should update step to running
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should record start event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.started',
        { name: 'test-echo', tool: 'test:echo' },
        'step-123'
      );

      // Should update step to succeeded with echo outputs
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: { echo: { message: 'hello world', data: 42 } }
      });

      // Should record finish event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.finished',
        { outputs: { echo: { message: 'hello world', data: 42 } } },
        'step-123'
      );
    });

    it('should handle empty inputs', async () => {
      const step = {
        id: 'step-456',
        name: 'empty-test',
        tool: 'test:echo',
        inputs: null
      };

      await testEchoHandler.run({
        runId: 'run-456',
        step: step as any,
      });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-456',
        expect.objectContaining({
          outputs: { echo: {} }
        })
      );
    });

    it('should handle undefined inputs', async () => {
      const step = {
        id: 'step-789',
        name: 'undefined-test',
        tool: 'test:echo'
        // No inputs property
      };

      await testEchoHandler.run({
        runId: 'run-789',
        step: step as any,
      });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-789',
        expect.objectContaining({
          outputs: { echo: {} }
        })
      );
    });

    it('should handle complex nested inputs', async () => {
      const complexInputs = {
        nested: {
          object: {
            with: ['arrays', 'and', 'strings'],
            numbers: 42,
            boolean: true
          }
        },
        array: [1, 2, { key: 'value' }]
      };

      const step = {
        id: 'step-complex',
        name: 'complex-test',
        tool: 'test:echo',
        inputs: complexInputs
      };

      await testEchoHandler.run({
        runId: 'run-complex',
        step: step as any,
      });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-complex',
        expect.objectContaining({
          outputs: { echo: complexInputs }
        })
      );
    });
  });
});