import type { StepHandler } from './types';
import { store } from '../../lib/store';
import { recordEvent } from '../../lib/events';
import { log } from '../../lib/logger';
import { saveArtifact } from '../../lib/artifacts';
import { AgentSdkAdapter } from '../../lib/agentSdk/adapter';

/**
 * SDK-powered code generation handler
 *
 * This is the next-generation codegen handler that uses the Claude Agent SDK
 * instead of the custom model router. It provides:
 * - Session persistence (memory across steps)
 * - Streaming responses with backpressure
 * - Automatic cost tracking
 * - Better error handling
 *
 * To use this handler, specify tool: "codegen:v2" in your plan steps.
 *
 * The legacy codegen handler remains available for backward compatibility.
 */
export const handler: StepHandler = {
  match: (tool: string) => tool === 'codegen:v2',

  async run({ runId, step }) {
    log.info({
      runId,
      stepId: step.id,
      tool: step.tool,
      inputs: step.inputs
    }, 'Starting SDK-powered codegen');

    try {
      const adapter = new AgentSdkAdapter();

      // Execute with Agent SDK
      const result = await adapter.executeWithSdk(step, {
        runId,
        model: step.inputs?.model || process.env.AGENT_SDK_MODEL || 'claude-sonnet-4-5',
        sessionMemory: true, // SDK persists session automatically
        temperature: step.inputs?.temperature || parseFloat(process.env.AGENT_SDK_TEMPERATURE || '0.7'),
        maxTokens: step.inputs?.maxTokens || parseInt(process.env.AGENT_SDK_MAX_TOKENS || '4096', 10),
      });

      // Store artifact (NOFX continues to handle storage)
      const filename = step.inputs?.filename || 'generated.md';
      const artifactPath = await saveArtifact(
        runId,
        step.id,
        filename,
        result.response,
        'text/markdown'
      );

      // Update step with outputs
      await store.updateStep(step.id, {
        status: 'succeeded',
        outputs: {
          artifact: artifactPath,
          filename,
          tokensUsed: result.metadata.tokensUsed,
          cost: result.metadata.cost,
          model: result.metadata.model,
          sessionId: result.metadata.sessionId,
          generatedBy: 'agent-sdk',
        },
        ended_at: new Date().toISOString(),
      });

      // Record completion event
      await recordEvent(
        runId,
        'codegen.completed',
        {
          artifact: artifactPath,
          tokensUsed: result.metadata.tokensUsed,
          cost: result.metadata.cost,
          model: result.metadata.model,
          handler: 'codegen:v2',
        },
        step.id
      );

      // Check cost alert threshold
      const costThreshold = parseFloat(process.env.AGENT_SDK_COST_ALERT_THRESHOLD || '10.0');
      if (result.metadata.cost > costThreshold) {
        log.warn({
          runId,
          stepId: step.id,
          cost: result.metadata.cost,
          threshold: costThreshold,
        }, 'Step cost exceeded alert threshold');

        await recordEvent(
          runId,
          'cost.alert',
          {
            cost: result.metadata.cost,
            threshold: costThreshold,
            stepId: step.id,
          },
          step.id
        );
      }

      log.info({
        runId,
        stepId: step.id,
        tokensUsed: result.metadata.tokensUsed,
        cost: result.metadata.cost,
        model: result.metadata.model,
      }, 'SDK-powered codegen completed successfully');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      log.error({
        error,
        runId,
        stepId: step.id,
        message,
        stack,
      }, 'SDK codegen failed');

      await store.updateStep(step.id, {
        status: 'failed',
        outputs: {
          error: message,
          generatedBy: 'agent-sdk',
        },
        ended_at: new Date().toISOString(),
      });

      await recordEvent(
        runId,
        'codegen.failed',
        {
          error: message,
          handler: 'codegen:v2',
        },
        step.id
      );

      throw error;
    }
  },
};

export default handler;