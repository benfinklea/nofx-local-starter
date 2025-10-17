/**
 * Agent SDK Integration Tests
 *
 * These tests verify the Agent SDK integration works end-to-end.
 * They require ANTHROPIC_API_KEY to be set and will make real API calls.
 *
 * Run with: npm test -- agent-sdk.integration.test.ts
 * Skip with: SKIP_SDK_INTEGRATION=true npm test
 */

import { AgentSdkAdapter, type AgentSdkContext } from '../../src/lib/agentSdk/adapter';
import type { Step } from '../../src/worker/handlers/types';

// Skip these tests if SDK integration is disabled
const describeIfEnabled = process.env.SKIP_SDK_INTEGRATION === 'true' ? describe.skip : describe;

describeIfEnabled('Agent SDK Integration (Real API)', () => {
  let adapter: AgentSdkAdapter;

  beforeAll(() => {
    // Verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required for Agent SDK integration tests. ' +
        'Set SKIP_SDK_INTEGRATION=true to skip these tests.'
      );
    }

    adapter = new AgentSdkAdapter();
  });

  describe('basic execution', () => {
    it('should execute a simple prompt', async () => {
      const step: Step = {
        id: 'integration-test-1',
        run_id: 'integration-run-1',
        name: 'simple-test',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Say "Hello from Agent SDK integration test" and nothing else.',
        },
      };

      const context: AgentSdkContext = {
        runId: 'integration-run-1',
        model: 'claude-sonnet-4-5',
      };

      const result = await adapter.executeWithSdk(step, context);

      expect(result).toBeDefined();
      expect(result.response).toContain('Hello');
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.cost).toBeGreaterThan(0);
      expect(result.metadata.model).toBe('claude-sonnet-4-5');
      expect(result.metadata.sessionId).toBe('integration-run-1');
    }, 30000); // 30 second timeout

    it('should execute with topic and bullets', async () => {
      const step: Step = {
        id: 'integration-test-2',
        run_id: 'integration-run-2',
        name: 'topic-bullets-test',
        tool: 'codegen:v2',
        inputs: {
          topic: 'Testing best practices',
          bullets: [
            'Write clear test names',
            'Test one thing at a time',
            'Use descriptive assertions',
          ],
        },
      };

      const context: AgentSdkContext = {
        runId: 'integration-run-2',
      };

      const result = await adapter.executeWithSdk(step, context);

      expect(result.response).toBeTruthy();
      expect(result.response.length).toBeGreaterThan(50);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
    }, 30000);
  });

  describe('session persistence', () => {
    it('should remember context across steps in same session', async () => {
      const runId = 'integration-session-test';

      // Step 1: Provide context
      const step1: Step = {
        id: 'session-step-1',
        run_id: runId,
        name: 'provide-context',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Remember this number: 42. Just acknowledge you remember it.',
        },
      };

      const context1: AgentSdkContext = {
        runId,
        sessionMemory: true,
      };

      const result1 = await adapter.executeWithSdk(step1, context1);
      expect(result1.response).toBeTruthy();

      // Step 2: Recall context
      const step2: Step = {
        id: 'session-step-2',
        run_id: runId,
        name: 'recall-context',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'What number did I ask you to remember? Just give me the number.',
        },
      };

      const context2: AgentSdkContext = {
        runId,
        sessionMemory: true,
      };

      const result2 = await adapter.executeWithSdk(step2, context2);

      // Should remember "42"
      expect(result2.response).toContain('42');
    }, 60000); // 60 seconds for two API calls

    it('should not remember context without session memory', async () => {
      const runId1 = 'integration-no-session-1';
      const runId2 = 'integration-no-session-2';

      // Step 1: Provide context (no session memory)
      const step1: Step = {
        id: 'no-session-step-1',
        run_id: runId1,
        name: 'provide-context',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Remember this color: blue. Just acknowledge it.',
        },
      };

      const context1: AgentSdkContext = {
        runId: runId1,
        sessionMemory: false,
      };

      const result1 = await adapter.executeWithSdk(step1, context1);
      expect(result1.response).toBeTruthy();

      // Step 2: Try to recall (different runId, no session)
      const step2: Step = {
        id: 'no-session-step-2',
        run_id: runId2,
        name: 'try-recall',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'What color did I just tell you to remember?',
        },
      };

      const context2: AgentSdkContext = {
        runId: runId2,
        sessionMemory: false,
      };

      const result2 = await adapter.executeWithSdk(step2, context2);

      // Should NOT remember "blue" - should indicate it doesn't know
      expect(result2.response.toLowerCase()).not.toContain('blue');
    }, 60000);
  });

  describe('cost tracking', () => {
    it('should accurately track tokens and cost', async () => {
      const step: Step = {
        id: 'cost-tracking-test',
        run_id: 'integration-cost-run',
        name: 'cost-test',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Write a haiku about testing. Be concise.',
        },
      };

      const context: AgentSdkContext = {
        runId: 'integration-cost-run',
        model: 'claude-sonnet-4-5',
      };

      const result = await adapter.executeWithSdk(step, context);

      // Verify cost tracking
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeLessThan(1000); // Haiku should be small
      expect(result.metadata.cost).toBeGreaterThan(0);
      expect(result.metadata.cost).toBeLessThan(0.01); // Should be very cheap

      // Verify cost is reasonable for token count
      const avgCostPerToken = result.metadata.cost / result.metadata.tokensUsed;
      expect(avgCostPerToken).toBeLessThan(0.0001); // Sanity check
    }, 30000);

    it('should report higher cost for opus model', async () => {
      const step: Step = {
        id: 'opus-cost-test',
        run_id: 'integration-opus-cost',
        name: 'opus-test',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Say hello in one word.',
        },
      };

      const context: AgentSdkContext = {
        runId: 'integration-opus-cost',
        model: 'claude-opus-4',
      };

      const result = await adapter.executeWithSdk(step, context);

      expect(result.metadata.cost).toBeGreaterThan(0);
      expect(result.metadata.model).toBe('claude-opus-4');

      // Opus should cost more per token than Sonnet
      const costPerToken = result.metadata.cost / result.metadata.tokensUsed;
      expect(costPerToken).toBeGreaterThan(0.00001); // Opus is expensive
    }, 30000);
  });

  describe('different models', () => {
    it('should work with claude-sonnet-4-5', async () => {
      const step: Step = {
        id: 'sonnet-test',
        run_id: 'model-test-sonnet',
        name: 'sonnet',
        tool: 'codegen:v2',
        inputs: { prompt: 'Say "Sonnet test" and nothing else.' },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'model-test-sonnet',
        model: 'claude-sonnet-4-5',
      });

      expect(result.metadata.model).toBe('claude-sonnet-4-5');
      expect(result.response).toContain('Sonnet');
    }, 30000);

    it('should work with claude-haiku-3-5', async () => {
      const step: Step = {
        id: 'haiku-test',
        run_id: 'model-test-haiku',
        name: 'haiku',
        tool: 'codegen:v2',
        inputs: { prompt: 'Say "Haiku test" and nothing else.' },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'model-test-haiku',
        model: 'claude-haiku-3-5',
      });

      expect(result.metadata.model).toBe('claude-haiku-3-5');
      expect(result.response).toContain('Haiku');

      // Haiku should be cheaper
      expect(result.metadata.cost).toBeLessThan(0.001);
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle invalid model gracefully', async () => {
      const step: Step = {
        id: 'invalid-model-test',
        run_id: 'error-test-model',
        name: 'invalid',
        tool: 'codegen:v2',
        inputs: { prompt: 'test' },
      };

      await expect(
        adapter.executeWithSdk(step, {
          runId: 'error-test-model',
          model: 'invalid-model-name' as any,
        })
      ).rejects.toThrow('Invalid model');
    });

    it('should handle empty prompts', async () => {
      const step: Step = {
        id: 'empty-prompt-test',
        run_id: 'error-test-empty',
        name: 'empty',
        tool: 'codegen:v2',
        inputs: { prompt: '   ' },
      };

      await expect(
        adapter.executeWithSdk(step, {
          runId: 'error-test-empty',
        })
      ).rejects.toThrow('Cannot execute SDK with empty prompt');
    });
  });

  describe('performance', () => {
    it('should complete simple prompts in under 10 seconds', async () => {
      const step: Step = {
        id: 'perf-test',
        run_id: 'perf-run',
        name: 'performance',
        tool: 'codegen:v2',
        inputs: { prompt: 'Count to 3.' },
      };

      const startTime = Date.now();

      const result = await adapter.executeWithSdk(step, {
        runId: 'perf-run',
        model: 'claude-haiku-3-5', // Fastest model
      });

      const duration = Date.now() - startTime;

      expect(result.response).toBeTruthy();
      expect(duration).toBeLessThan(10000); // Should be fast
    }, 15000);
  });
});

/**
 * Quick smoke test that can run without API key
 */
describe('Agent SDK Adapter (Unit)', () => {
  it('should instantiate without errors', () => {
    const adapter = new AgentSdkAdapter();
    expect(adapter).toBeDefined();
  });

  it('should validate step configuration', async () => {
    const adapter = new AgentSdkAdapter();
    const invalidStep = null as any;
    const context = { runId: 'test' };

    await expect(
      adapter.executeWithSdk(invalidStep, context)
    ).rejects.toThrow('Step configuration is required');
  });
});
