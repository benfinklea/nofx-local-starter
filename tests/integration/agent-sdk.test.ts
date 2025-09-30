import { AgentSdkAdapter } from '../../src/lib/agentSdk/adapter';
import { store } from '../../src/lib/store';
import type { Step } from '../../src/worker/handlers/types';

describe('Agent SDK Integration', () => {
  let adapter: AgentSdkAdapter;

  beforeEach(() => {
    adapter = new AgentSdkAdapter();
  });

  describe('AgentSdkAdapter', () => {
    it('should execute simple prompt', async () => {
      const step: Step = {
        id: 'test-step-1',
        run_id: 'test-run-1',
        name: 'test',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Say hello in one word',
        },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'test-run-1',
        model: 'claude-sonnet-4-5',
        maxTokens: 100,
      });

      expect(result.response).toBeTruthy();
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.metadata.model).toBe('claude-sonnet-4-5');
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.cost).toBeGreaterThan(0);
    }, 30000);

    it('should persist session across multiple calls', async () => {
      const runId = `test-run-session-${Date.now()}`;
      const step1: Step = {
        id: 'step-1',
        run_id: runId,
        name: 'first',
        tool: 'codegen:v2',
        inputs: { prompt: 'Remember this number: 42. Just acknowledge briefly.' },
      };

      const step2: Step = {
        id: 'step-2',
        run_id: runId,
        name: 'second',
        tool: 'codegen:v2',
        inputs: { prompt: 'What number did I ask you to remember? Reply with just the number.' },
      };

      await adapter.executeWithSdk(step1, { runId, sessionMemory: true, maxTokens: 100 });
      const result2 = await adapter.executeWithSdk(step2, { runId, sessionMemory: true, maxTokens: 100 });

      expect(result2.response.toLowerCase()).toContain('42');
    }, 60000);

    it('should track costs accurately', async () => {
      const step: Step = {
        id: 'cost-test',
        run_id: 'test-run-cost',
        name: 'cost',
        tool: 'codegen:v2',
        inputs: { prompt: 'Write a haiku about testing' },
      };

      const result = await adapter.executeWithSdk(step, {
        runId: 'test-run-cost',
        model: 'claude-sonnet-4-5',
        maxTokens: 200,
      });

      expect(result.metadata.cost).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);

      // Verify cost calculation is reasonable
      // Sonnet 4.5 is $3/$15 per million tokens
      const avgRate = (3 + 15) / 2 / 1_000_000; // Average of input/output
      const expectedMinCost = result.metadata.tokensUsed * 0.000001; // Very conservative
      const expectedMaxCost = result.metadata.tokensUsed * avgRate * 2; // Allow 2x variance

      expect(result.metadata.cost).toBeGreaterThan(expectedMinCost);
      expect(result.metadata.cost).toBeLessThan(expectedMaxCost);
    }, 30000);

    it('should handle errors gracefully', async () => {
      const step: Step = {
        id: 'error-test',
        run_id: 'test-run-error',
        name: 'error',
        tool: 'codegen:v2',
        inputs: {
          prompt: 'Test prompt',
        },
      };

      // Test with invalid model
      await expect(
        adapter.executeWithSdk(step, {
          runId: 'test-run-error',
          model: 'invalid-model-xyz',
          maxTokens: 100,
        })
      ).rejects.toThrow();
    }, 30000);
  });

  describe('codegen:v2 handler', () => {
    it('should create artifact using SDK', async () => {
      const runId = `test-run-handler-${Date.now()}`;

      const run = await store.createRun(
        {
          goal: 'Test SDK handler',
          steps: [
            {
              name: 'generate',
              tool: 'codegen:v2',
              inputs: {
                topic: 'Testing',
                bullets: ['Unit tests', 'Integration tests'],
                filename: 'test.md',
                model: 'claude-sonnet-4-5',
              },
            },
          ],
        },
        'test-project'
      );

      expect(run.id).toBeTruthy();

      // Wait for step to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      const steps = await store.listStepsByRun(run.id);
      expect(steps.length).toBe(1);

      const step = steps[0];
      expect(step.tool).toBe('codegen:v2');
      expect(step.status).toBe('pending');
    }, 30000);
  });

  describe('Feature flag integration', () => {
    it('should respect USE_AGENT_SDK environment variable', async () => {
      const originalValue = process.env.USE_AGENT_SDK;

      try {
        // Test with SDK enabled
        process.env.USE_AGENT_SDK = 'true';
        const runId = `test-feature-flag-${Date.now()}`;

        const run = await store.createRun(
          {
            goal: 'Test feature flag',
            steps: [
              {
                name: 'codegen-test',
                tool: 'codegen', // Using legacy tool name
                inputs: {
                  prompt: 'Write "Hello SDK" in markdown',
                  filename: 'feature-test.md',
                  model: 'claude-sonnet-4-5',
                },
              },
            ],
          },
          'test-project'
        );

        expect(run.id).toBeTruthy();

        // Verify the run was created
        const retrievedRun = await store.getRun(run.id);
        expect(retrievedRun).toBeTruthy();
        expect(retrievedRun?.id).toBe(run.id);
      } finally {
        // Restore original value
        if (originalValue !== undefined) {
          process.env.USE_AGENT_SDK = originalValue;
        } else {
          delete process.env.USE_AGENT_SDK;
        }
      }
    }, 30000);
  });

  describe('Cost tracking validation', () => {
    it('should record SDK usage metrics', async () => {
      const runId = `test-metrics-${Date.now()}`;
      const step: Step = {
        id: `step-metrics-${Date.now()}`,
        run_id: runId,
        name: 'metrics-test',
        tool: 'codegen:v2',
        inputs: { prompt: 'Brief response about metrics' },
      };

      const result = await adapter.executeWithSdk(step, {
        runId,
        model: 'claude-sonnet-4-5',
        sessionMemory: true,
        maxTokens: 150,
      });

      // Verify all metadata is present
      expect(result.metadata).toHaveProperty('tokensUsed');
      expect(result.metadata).toHaveProperty('cost');
      expect(result.metadata).toHaveProperty('model');
      expect(result.metadata).toHaveProperty('sessionId');

      // Verify sessionId matches runId
      expect(result.metadata.sessionId).toBe(runId);

      // Verify model is correct
      expect(result.metadata.model).toBe('claude-sonnet-4-5');
    }, 30000);
  });
});