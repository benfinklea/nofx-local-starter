import { recordEvent } from '../events';
import { log } from '../logger';
import type { Step } from '../../worker/handlers/types';
import { query, type Options, type SDKMessage, type SDKAssistantMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

export interface AgentSdkContext {
  runId: string;
  model?: string;
  sessionMemory?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ExecutionResult {
  response: string;
  metadata: {
    tokensUsed: number;
    cost: number;
    model: string;
    sessionId: string;
  };
}

/**
 * Adapter layer between NOFX orchestration and Claude Agent SDK
 *
 * This adapter wraps the Agent SDK to integrate with NOFX's:
 * - Event system (audit trail)
 * - Storage system (artifacts)
 * - Queue system (async execution)
 *
 * The Agent SDK provides:
 * - Session management (memory/context)
 * - Streaming responses
 * - Cost tracking
 * - Tool execution
 */
export class AgentSdkAdapter {
  /**
   * Execute a step using the Agent SDK instead of custom model router
   */
  async executeWithSdk(
    step: Step,
    context: AgentSdkContext
  ): Promise<ExecutionResult> {
    const sessionId = context.runId; // Map NOFX run to SDK session
    const prompt = this.buildPrompt(step);

    // Build SDK options
    const options: Options = {
      model: context.model || 'claude-sonnet-4-5',
      resume: context.sessionMemory ? sessionId : undefined,
      maxTurns: 1, // Single turn for code generation
      cwd: process.cwd(),
      allowedTools: this.extractAllowedTools(step),
      hooks: this.buildHooks(step, context),
    };

    log.info({
      runId: context.runId,
      stepId: step.id,
      model: options.model,
      sessionId,
    }, 'Executing step with Agent SDK');

    try {
      // Execute with real Agent SDK
      const generator = query({ prompt, options });

      let responseText = '';
      let tokensUsed = 0;
      let cost = 0;

      // Process all messages from the SDK
      for await (const message of generator) {
        await this.processSDKMessage(message, step, context);

        // Extract text from assistant messages
        if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage;
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }

        // Extract usage from result message
        if (message.type === 'result') {
          const resultMsg = message as SDKResultMessage;
          tokensUsed = resultMsg.usage.input_tokens + resultMsg.usage.output_tokens;
          cost = resultMsg.total_cost_usd;
        }
      }

      return {
        response: responseText,
        metadata: {
          tokensUsed,
          cost,
          model: options.model || 'claude-sonnet-4-5',
          sessionId,
        },
      };
    } catch (error) {
      log.error({ error, runId: context.runId, stepId: step.id }, 'SDK execution failed');
      throw error;
    }
  }

  /**
   * Process SDK messages and emit events
   */
  private async processSDKMessage(
    message: SDKMessage,
    step: Step,
    context: AgentSdkContext
  ): Promise<void> {
    // Emit event for timeline tracking
    await recordEvent(
      context.runId,
      'sdk.message',
      {
        type: message.type,
        messageId: message.uuid,
        sessionId: message.session_id,
      },
      step.id
    );

    // Handle specific message types
    if (message.type === 'stream_event') {
      // Stream events for real-time updates
      await recordEvent(
        context.runId,
        'sdk.stream',
        {
          event: message.event.type,
        },
        step.id
      );
    }
  }

  /**
   * Extract allowed tools from step configuration
   */
  private extractAllowedTools(step: Step): string[] | undefined {
    const tools: string[] = [];

    // Check if step explicitly requests tools
    if (step.inputs?._tools) {
      if (Array.isArray(step.inputs._tools)) {
        return step.inputs._tools;
      }
    }

    // Default tools for code generation
    return ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
  }

  /**
   * Build prompt from step inputs
   */
  private buildPrompt(step: Step): string {
    const inputs = step.inputs || {};

    if (inputs.prompt) {
      return String(inputs.prompt);
    }

    if (inputs.topic && inputs.bullets) {
      const bullets = Array.isArray(inputs.bullets)
        ? inputs.bullets.join('\n- ')
        : '';
      return `Write about: ${inputs.topic}\n\nInclude these points:\n- ${bullets}`;
    }

    return `Execute tool: ${step.tool}`;
  }

  /**
   * Build SDK hooks for lifecycle events
   */
  private buildHooks(step: Step, context: AgentSdkContext): Options['hooks'] {
    return {
      PostToolUse: [
        {
          hooks: [
            async (input, toolUseID, options) => {
              await recordEvent(
                context.runId,
                'sdk.tool_use',
                {
                  toolName: input.tool_name,
                  toolInput: input.tool_input,
                  toolResponse: input.tool_response,
                },
                step.id
              );
              return {};
            },
          ],
        },
      ],
    };
  }

}