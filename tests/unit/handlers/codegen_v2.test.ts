/**
 * Unit tests for codegen_v2 handler (SDK-powered codegen)
 * Coverage target: 90%+
 *
 * Tests SDK integration including:
 * - Session management
 * - Cost tracking
 * - Artifact generation
 * - Error handling
 */

import type { StepHandler, Step } from '../../../src/worker/handlers/types';

// Mock all dependencies
jest.mock('../../../src/lib/store');
jest.mock('../../../src/lib/events');
jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../../src/lib/artifacts');
jest.mock('../../../src/lib/agentSdk/adapter');

describe('codegen_v2 handler', () => {
  let handler: StepHandler;
  const mockStore = require('../../../src/lib/store').store;
  const mockRecordEvent = require('../../../src/lib/events').recordEvent;
  const mockSaveArtifact = require('../../../src/lib/artifacts').saveArtifact;
  const { AgentSdkAdapter } = require('../../../src/lib/agentSdk/adapter');
  const mockLog = require('../../../src/lib/logger').log;

  beforeAll(async () => {
    handler = (await import('../../../src/worker/handlers/codegen_v2')).default;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockStore.updateStep = jest.fn().mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockSaveArtifact.mockResolvedValue('runs/run-456/generated.md');

    // Mock AgentSdkAdapter
    AgentSdkAdapter.mockImplementation(() => ({
      executeWithSdk: jest.fn().mockResolvedValue({
        response: '# Generated Content\n\nThis is generated content.',
        metadata: {
          tokensUsed: 1234,
          cost: 0.05,
          model: 'claude-sonnet-4-5',
          sessionId: 'session-abc123'
        }
      })
    }));
  });

  describe('match', () => {
    it('should match codegen:v2 tool', () => {
      expect(handler.match('codegen:v2')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(handler.match('codegen')).toBe(false);
      expect(handler.match('codegen:v1')).toBe(false);
      expect(handler.match('bash')).toBe(false);
      expect(handler.match('codegenV2')).toBe(false);
    });
  });

  describe('run - successful generation', () => {
    it('should generate content with SDK', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate-docs',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Generate API documentation',
          filename: 'api-docs.md'
        }
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          runId: 'run-456',
          sessionMemory: true
        })
      );
    });

    it('should save artifact with correct path', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate-code',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Generate TypeScript service',
          filename: 'user-service.ts'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-456',
        'step-123',
        'user-service.ts',
        '# Generated Content\n\nThis is generated content.',
        'text/markdown'
      );
    });

    it('should update step with success and metadata', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {
          filename: 'output.md'
        }
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        outputs: {
          artifact: 'runs/run-456/generated.md',
          filename: 'output.md',
          tokensUsed: 1234,
          cost: 0.05,
          model: 'claude-sonnet-4-5',
          sessionId: 'session-abc123',
          generatedBy: 'agent-sdk'
        },
        ended_at: expect.any(String)
      });
    });

    it('should use default filename when not provided', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-456',
        'step-123',
        'generated.md',
        expect.any(String),
        'text/markdown'
      );
    });

    it('should record completion event', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'codegen.completed',
        {
          artifact: 'runs/run-456/generated.md',
          tokensUsed: 1234,
          cost: 0.05,
          model: 'claude-sonnet-4-5',
          handler: 'codegen:v2'
        },
        'step-123'
      );
    });
  });

  describe('run - SDK configuration', () => {
    it('should use model from step inputs', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {
          model: 'claude-opus-4'
        }
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          model: 'claude-opus-4'
        })
      );
    });

    it('should use model from environment when not in inputs', async () => {
      process.env.AGENT_SDK_MODEL = 'claude-haiku-3-5';

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          model: 'claude-haiku-3-5'
        })
      );

      delete process.env.AGENT_SDK_MODEL;
    });

    it('should use default model when not configured', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          model: 'claude-sonnet-4-5'
        })
      );
    });

    it('should use temperature from step inputs', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {
          temperature: 0.9
        }
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          temperature: 0.9
        })
      );
    });

    it('should use maxTokens from step inputs', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {
          maxTokens: 8192
        }
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          maxTokens: 8192
        })
      );
    });

    it('should enable session memory by default', async () => {
      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      const adapterInstance = AgentSdkAdapter.mock.results[0].value;
      expect(adapterInstance.executeWithSdk).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          sessionMemory: true
        })
      );
    });
  });

  describe('run - cost alerting', () => {
    it('should trigger cost alert when threshold exceeded', async () => {
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockResolvedValue({
          response: 'Expensive generation',
          metadata: {
            tokensUsed: 50000,
            cost: 15.0,
            model: 'claude-opus-4',
            sessionId: 'session-xyz'
          }
        })
      }));

      process.env.AGENT_SDK_COST_ALERT_THRESHOLD = '10.0';

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'cost.alert',
        {
          cost: 15.0,
          threshold: 10.0,
          stepId: 'step-123'
        },
        'step-123'
      );

      delete process.env.AGENT_SDK_COST_ALERT_THRESHOLD;
    });

    it('should not trigger alert when cost is below threshold', async () => {
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockResolvedValue({
          response: 'Cheap generation',
          metadata: {
            tokensUsed: 500,
            cost: 0.02,
            model: 'claude-haiku-3-5',
            sessionId: 'session-xyz'
          }
        })
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockRecordEvent).not.toHaveBeenCalledWith(
        'run-456',
        'cost.alert',
        expect.any(Object),
        'step-123'
      );
    });
  });

  describe('run - error handling', () => {
    it('should handle SDK execution errors', async () => {
      const sdkError = new Error('API rate limit exceeded');
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockRejectedValue(sdkError)
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await expect(handler.run({ runId: 'run-456', step })).rejects.toThrow('API rate limit exceeded');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: {
          error: 'API rate limit exceeded',
          generatedBy: 'agent-sdk'
        },
        ended_at: expect.any(String)
      });
    });

    it('should record failure event on error', async () => {
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockRejectedValue(new Error('Network timeout'))
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await expect(handler.run({ runId: 'run-456', step })).rejects.toThrow();

      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-456',
        'codegen.failed',
        {
          error: 'Network timeout',
          handler: 'codegen:v2'
        },
        'step-123'
      );
    });

    it('should handle non-Error exceptions', async () => {
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockRejectedValue('String error')
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await expect(handler.run({ runId: 'run-456', step })).rejects.toBe('String error');

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'failed',
        outputs: {
          error: 'String error',
          generatedBy: 'agent-sdk'
        },
        ended_at: expect.any(String)
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty response from SDK', async () => {
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockResolvedValue({
          response: '',
          metadata: {
            tokensUsed: 10,
            cost: 0.001,
            model: 'claude-sonnet-4-5',
            sessionId: 'session-empty'
          }
        })
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-456',
        'step-123',
        'generated.md',
        '',
        'text/markdown'
      );
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        outputs: expect.objectContaining({
          generatedBy: 'agent-sdk'
        }),
        ended_at: expect.any(String)
      });
    });

    it('should handle large generated content', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockResolvedValue({
          response: largeContent,
          metadata: {
            tokensUsed: 100000,
            cost: 5.0,
            model: 'claude-opus-4',
            sessionId: 'session-large'
          }
        })
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-456',
        'step-123',
        'generated.md',
        largeContent,
        'text/markdown'
      );
    });

    it('should preserve session ID across steps', async () => {
      const sessionId = 'persistent-session-123';
      AgentSdkAdapter.mockImplementation(() => ({
        executeWithSdk: jest.fn().mockResolvedValue({
          response: 'Content',
          metadata: {
            tokensUsed: 100,
            cost: 0.01,
            model: 'claude-sonnet-4-5',
            sessionId
          }
        })
      }));

      const step: Step = {
        id: 'step-123',
        run_id: 'run-456',
        name: 'generate',
        tool: 'codegen:v2',
        inputs: {}
      };

      await handler.run({ runId: 'run-456', step });

      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        outputs: expect.objectContaining({
          sessionId
        }),
        ended_at: expect.any(String)
      });
    });
  });
});
