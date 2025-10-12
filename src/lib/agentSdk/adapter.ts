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
  private readonly DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
  private readonly VALID_MODELS = [
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'claude-opus-4',
    'claude-haiku-3-5',
  ];

  /**
   * Execute a step using the Agent SDK instead of custom model router
   */
  async executeWithSdk(
    step: Step,
    context: AgentSdkContext
  ): Promise<ExecutionResult> {
    // Validate inputs
    this.validateStep(step);
    this.validateContext(context);

    const sessionId = context.runId;
    const prompt = this.buildPrompt(step);

    // Validate prompt is not empty
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Cannot execute SDK with empty prompt');
    }

    const selectedModel = context.model || 'claude-sonnet-4-5';

    // Build SDK options
    const options: Options = {
      model: selectedModel,
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
      promptLength: prompt.length,
    }, 'Executing step with Agent SDK');

    try {
      // Execute with timeout protection
      const result = await this.executeWithTimeout(
        async () => {
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

          // Validate we got a response
          if (!responseText && tokensUsed === 0) {
            throw new Error('SDK completed but returned no response');
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
        },
        this.DEFAULT_TIMEOUT_MS
      );

      return result;
    } catch (error) {
      // Enhance error with context
      const enhancedError = this.enhanceError(error, {
        runId: context.runId,
        stepId: step.id,
        model: selectedModel,
        promptLength: prompt.length,
      });

      log.error({
        error: enhancedError,
        runId: context.runId,
        stepId: step.id,
        model: selectedModel,
      }, 'SDK execution failed');

      throw enhancedError;
    }
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`SDK execution timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Validate step configuration
   */
  private validateStep(step: Step): void {
    if (!step) {
      throw new Error('Step configuration is required');
    }
    if (!step.id) {
      throw new Error('Step must have an ID');
    }
    if (!step.tool) {
      throw new Error('Step must specify a tool');
    }
  }

  /**
   * Validate execution context
   */
  private validateContext(context: AgentSdkContext): void {
    if (!context) {
      throw new Error('Execution context is required');
    }
    if (!context.runId) {
      throw new Error('Context must have a runId');
    }
    if (context.model && !this.VALID_MODELS.includes(context.model)) {
      log.warn(
        { model: context.model, validModels: this.VALID_MODELS },
        'Unknown model specified, using default'
      );
    }
  }

  /**
   * Enhance error with execution context
   */
  private enhanceError(error: unknown, context: {
    runId: string;
    stepId: string;
    model: string;
    promptLength: number;
  }): Error {
    const originalMessage = error instanceof Error ? error.message : String(error);

    let enhancedMessage = `Agent SDK execution failed: ${originalMessage}`;

    // Add helpful context
    if (originalMessage.includes('timeout')) {
      enhancedMessage += ` (Model: ${context.model}, Prompt length: ${context.promptLength} chars)`;
    } else if (originalMessage.includes('rate limit') || originalMessage.includes('429')) {
      enhancedMessage = 'Claude API rate limit exceeded. Please try again in a few moments.';
    } else if (originalMessage.includes('auth') || originalMessage.includes('401')) {
      enhancedMessage = 'Claude API authentication failed. Please check ANTHROPIC_API_KEY environment variable.';
    } else if (originalMessage.includes('not found') || originalMessage.includes('404')) {
      enhancedMessage = `Model "${context.model}" not found or not accessible.`;
    }

    const enhanced = new Error(enhancedMessage);
    // Store original error for debugging (error.cause requires ES2022)
    (enhanced as any).originalError = error;
    return enhanced;
  }

  /**
   * Process SDK messages and emit events
   * Event recording failures are logged but don't block execution
   */
  private async processSDKMessage(
    message: SDKMessage,
    step: Step,
    context: AgentSdkContext
  ): Promise<void> {
    // Emit event for timeline tracking (graceful degradation)
    try {
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
    } catch (error) {
      // Event recording is non-critical - log and continue
      log.warn({
        error,
        runId: context.runId,
        stepId: step.id,
        messageType: message.type,
      }, 'Failed to record SDK message event');
    }

    // Handle specific message types
    if (message.type === 'stream_event') {
      // Stream events for real-time updates (graceful degradation)
      try {
        await recordEvent(
          context.runId,
          'sdk.stream',
          {
            event: message.event.type,
          },
          step.id
        );
      } catch (error) {
        // Stream event recording is non-critical - log and continue
        log.warn({
          error,
          runId: context.runId,
          stepId: step.id,
        }, 'Failed to record SDK stream event');
      }
    }
  }

  /**
   * Extract allowed tools from step configuration
   */
  private extractAllowedTools(step: Step): string[] | undefined {
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
   * Hooks use graceful degradation - failures are logged but don't block execution
   */
  private buildHooks(step: Step, context: AgentSdkContext): Options['hooks'] {
    return {
      PostToolUse: [
        {
          hooks: [
            async (input, _toolUseID, _options) => {
              // Type guard: PostToolUse hooks receive PostToolUseHookInput
              if (input.hook_event_name === 'PostToolUse') {
                try {
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
                } catch (error) {
                  // Hook event recording is non-critical - log and continue
                  log.warn({
                    error,
                    runId: context.runId,
                    stepId: step.id,
                    toolName: input.tool_name,
                  }, 'Failed to record tool use event in hook');
                }
              }
              return {};
            },
          ],
        },
      ],
    };
  }

}