import { AgentSdkAdapter, type AgentSdkContext, type ExecutionResult } from '../adapter';
import type { Step } from '../../../worker/handlers/types';
import { recordEvent } from '../../events';
import { log } from '../../logger';

// Mock dependencies
jest.mock('../../events');
jest.mock('../../logger');
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

describe('AgentSdkAdapter', () => {
  let adapter: AgentSdkAdapter;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    adapter = new AgentSdkAdapter();
    mockQuery = require('@anthropic-ai/claude-agent-sdk').query;
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should validate step configuration', async () => {
      const invalidStep = null as unknown as Step;
      const context: AgentSdkContext = { runId: 'test-run-1' };

      await expect(
        adapter.executeWithSdk(invalidStep, context)
      ).rejects.toThrow('Step configuration is required');
    });

    it('should validate step has ID', async () => {
      const invalidStep = { tool: 'codegen', inputs: {} } as Step;
      const context: AgentSdkContext = { runId: 'test-run-1' };

      await expect(
        adapter.executeWithSdk(invalidStep, context)
      ).rejects.toThrow('Step must have an ID');
    });

    it('should validate step has tool', async () => {
      const invalidStep = { id: 'step-1', inputs: {} } as Step;
      const context: AgentSdkContext = { runId: 'test-run-1' };

      await expect(
        adapter.executeWithSdk(invalidStep, context)
      ).rejects.toThrow('Step must specify a tool');
    });

    it('should validate context has runId', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const invalidContext = {} as AgentSdkContext;

      await expect(
        adapter.executeWithSdk(step, invalidContext)
      ).rejects.toThrow('Context must have a runId');
    });

    it('should validate model name', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = {
        runId: 'test-run-1',
        model: 'invalid-model',
      };

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('Invalid model');
    });

    it('should reject empty prompts', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: '   ' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('Cannot execute SDK with empty prompt');
    });
  });

  describe('prompt building', () => {
    it('should use explicit prompt when provided', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'Write a haiku about testing' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      // Mock SDK response
      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Test haiku here' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      const result = await adapter.executeWithSdk(step, context);

      expect(result.response).toContain('Test haiku');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Write a haiku about testing',
        })
      );
    });

    it('should build prompt from topic and bullets', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: {
          topic: 'Testing',
          bullets: ['Unit tests', 'Integration tests', 'E2E tests'],
        },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      // Mock SDK response
      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Testing guide' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      await adapter.executeWithSdk(step, context);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Testing'),
        })
      );
    });
  });

  describe('SDK options', () => {
    it('should use default model when not specified', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      const result = await adapter.executeWithSdk(step, context);

      expect(result.metadata.model).toBe('claude-sonnet-4-5');
    });

    it('should use custom model when specified', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = {
        runId: 'test-run-1',
        model: 'claude-opus-4',
      };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      const result = await adapter.executeWithSdk(step, context);

      expect(result.metadata.model).toBe('claude-opus-4');
    });

    it('should enable session memory when requested', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = {
        runId: 'test-run-1',
        sessionMemory: true,
      };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      await adapter.executeWithSdk(step, context);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            resume: 'test-run-1',
          }),
        })
      );
    });

    it('should extract custom tools from step inputs', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: {
          prompt: 'test',
          _tools: ['Read', 'Write'],
        },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      await adapter.executeWithSdk(step, context);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            allowedTools: ['Read', 'Write'],
          }),
        })
      );
    });
  });

  describe('response handling', () => {
    it('should extract text from assistant messages', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [
              { type: 'text', text: 'First part' },
              { type: 'text', text: ' second part' },
            ],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      const result = await adapter.executeWithSdk(step, context);

      expect(result.response).toBe('First part second part');
    });

    it('should extract usage and cost from result message', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 100, output_tokens: 200 },
          total_cost_usd: 0.005,
        };
      })());

      const result = await adapter.executeWithSdk(step, context);

      expect(result.metadata.tokensUsed).toBe(300);
      expect(result.metadata.cost).toBe(0.005);
      expect(result.metadata.sessionId).toBe('test-run-1');
    });

    it('should fail if SDK returns no response', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      // Mock empty response
      mockQuery.mockReturnValue((async function* () {
        // Empty generator
      })());

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('SDK completed but returned no response');
    });
  });

  describe('event recording', () => {
    it('should record SDK messages as events', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      await adapter.executeWithSdk(step, context);

      expect(recordEvent).toHaveBeenCalledWith(
        'test-run-1',
        'sdk.message',
        expect.objectContaining({
          type: 'assistant',
          messageId: 'msg-1',
        }),
        'step-1'
      );
    });

    it('should gracefully handle event recording failures', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      // Mock event recording to fail
      (recordEvent as jest.Mock).mockRejectedValue(new Error('Event DB error'));

      mockQuery.mockReturnValue((async function* () {
        yield {
          type: 'assistant',
          uuid: 'msg-1',
          session_id: 'test-run-1',
          message: {
            content: [{ type: 'text', text: 'Response' }],
          },
        };
        yield {
          type: 'result',
          uuid: 'result-1',
          session_id: 'test-run-1',
          usage: { input_tokens: 10, output_tokens: 20 },
          total_cost_usd: 0.0001,
        };
      })());

      // Should not throw despite event recording failures
      const result = await adapter.executeWithSdk(step, context);

      expect(result.response).toBe('Response');
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should enhance timeout errors', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      // Mock SDK to never complete
      mockQuery.mockReturnValue((async function* () {
        await new Promise(() => {}); // Never resolves
      })());

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('SDK execution timed out');
    }, 65000); // Slightly longer than default timeout

    it('should enhance rate limit errors', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockImplementation(() => {
        throw new Error('API rate limit exceeded (429)');
      });

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('Claude API rate limit exceeded');
    });

    it('should enhance authentication errors', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = { runId: 'test-run-1' };

      mockQuery.mockImplementation(() => {
        throw new Error('Authentication failed (401)');
      });

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('Claude API authentication failed');
    });

    it('should enhance model not found errors', async () => {
      const step: Step = {
        id: 'step-1',
        run_id: 'run-1',
        name: 'test',
        tool: 'codegen',
        inputs: { prompt: 'test' },
      };
      const context: AgentSdkContext = {
        runId: 'test-run-1',
        model: 'claude-opus-4',
      };

      mockQuery.mockImplementation(() => {
        throw new Error('Model not found (404)');
      });

      await expect(
        adapter.executeWithSdk(step, context)
      ).rejects.toThrow('Model "claude-opus-4" not found');
    });
  });
});
