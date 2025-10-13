/**
 * Unit tests for handler types and interfaces
 * Validates type definitions and contracts
 */

import type { StepHandler, Step } from '../../../src/worker/handlers/types';

describe('Handler Types and Interfaces', () => {
  describe('StepHandler interface', () => {
    it('should have required match and run methods', () => {
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn().mockResolvedValue(undefined)
      };

      expect(typeof mockHandler.match).toBe('function');
      expect(typeof mockHandler.run).toBe('function');
    });

    it('should match function return boolean', () => {
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn().mockResolvedValue(undefined)
      };

      expect(mockHandler.match('test')).toBe(true);
      expect(typeof mockHandler.match('test')).toBe('boolean');
    });

    it('should run function return promise', () => {
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn().mockResolvedValue(undefined)
      };

      const step: Step = {
        id: 'test',
        run_id: 'run',
        name: 'name',
        tool: 'tool',
        inputs: {}
      };

      const result = mockHandler.run({ runId: 'run', step });
      expect(result).toBeInstanceOf(Promise);
      expect(result).resolves.toBeUndefined();
    });
  });

  describe('Step interface', () => {
    it('should have all required properties', () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-step',
        tool: 'test:tool',
        inputs: { key: 'value' }
      };

      expect(step.id).toBe('step-123');
      expect(step.run_id).toBe('run-456');
      expect(step.name).toBe('test-step');
      expect(step.tool).toBe('test:tool');
      expect(step.inputs).toEqual({ key: 'value' });
    });

    it('should allow null inputs', () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-step',
        tool: 'test:tool',
        inputs: null
      };

      expect(step.inputs).toBeNull();
    });

    it('should allow complex nested inputs', () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test-step',
        tool: 'test:tool',
        inputs: {
          nested: {
            deep: {
              value: 'test',
              array: [1, 2, 3],
              object: { key: 'value' }
            }
          }
        }
      };

      expect(step.inputs).toBeDefined();
      expect(step.inputs.nested.deep.value).toBe('test');
      expect(step.inputs.nested.deep.array).toEqual([1, 2, 3]);
    });
  });

  describe('Handler context', () => {
    it('should provide runId and step in context', () => {
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn((context) => {
          expect(context).toHaveProperty('runId');
          expect(context).toHaveProperty('step');
          return Promise.resolve();
        })
      };

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test',
        tool: 'test',
        inputs: {}
      };

      return mockHandler.run({ runId: 'run-456', step });
    });

    it('should maintain consistent runId across context', () => {
      const mockHandler: StepHandler = {
        match: jest.fn().mockReturnValue(true),
        run: jest.fn((context) => {
          expect(context.runId).toBe(context.step.run_id);
          return Promise.resolve();
        })
      };

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'test',
        tool: 'test',
        inputs: {}
      };

      return mockHandler.run({ runId: 'run-456', step });
    });
  });
});
