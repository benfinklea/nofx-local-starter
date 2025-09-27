/**
 * Request Preparation Service - extracted from runCoordinator.ts
 * Handles request preparation, metadata merging, and speech options
 */

import { validateResponsesRequest } from '../../../shared/openai/responsesSchemas';
import type { ResponsesRequest } from '../../../shared/openai/responsesSchemas';
import type { ConversationPolicy } from '../conversationStateManager';
import type { ToolRequestConfig } from '../toolRegistry';
import type { HistoryPlan } from '../historyPlanner';

export interface SpeechOptions {
  mode: 'server_vad' | 'manual';
  inputFormat?: 'wav' | 'mp3' | 'pcm16';
  transcription?: {
    enabled: boolean;
    model?: string;
  };
}

interface PrepareRequestOptions {
  request: ResponsesRequest | Partial<ResponsesRequest>;
  context: {
    conversation?: string;
    storeFlag: boolean;
    previousResponseId?: string;
  };
  metadata?: Record<string, string>;
  tools?: ToolRequestConfig;
  maxToolCalls?: number;
  toolChoice?: ResponsesRequest['tool_choice'];
  speech?: SpeechOptions;
}

export class RequestPreparationService {
  constructor(private readonly toolRegistry: { buildToolPayload: (config: ToolRequestConfig) => any }) {}

  prepareRequest(options: PrepareRequestOptions): ResponsesRequest {
    const mergedMetadata: Record<string, string> = {
      ...(((options.request as ResponsesRequest).metadata) ?? {}),
      ...(options.metadata ?? {}),
    };
    this.applySpeechMetadata(mergedMetadata, options.speech);

    const requestPayload = validateResponsesRequest({
      ...options.request,
      model: options.request.model ?? 'gpt-4.1-mini',
      conversation: options.context.conversation,
      store: options.context.storeFlag,
      previous_response_id: options.context.previousResponseId,
      metadata: Object.keys(mergedMetadata).length ? mergedMetadata : undefined,
      tools: options.tools ? this.toolRegistry.buildToolPayload(options.tools) : (options.request as ResponsesRequest).tools,
      max_tool_calls: options.maxToolCalls ?? (options.request as ResponsesRequest).max_tool_calls,
      tool_choice: options.toolChoice ?? (options.request as ResponsesRequest).tool_choice,
    });

    return requestPayload;
  }

  resolvePolicy(policy: ConversationPolicy | undefined, plan?: HistoryPlan): ConversationPolicy | undefined {
    if (policy) return policy;
    if (plan?.strategy === 'vendor') return { strategy: 'vendor' };
    return undefined;
  }

  private applySpeechMetadata(target: Record<string, string>, speech?: SpeechOptions): void {
    if (!speech) return;
    target.speech_mode = speech.mode;
    if (speech.inputFormat) {
      target.speech_input_format = speech.inputFormat;
    }
    if (speech.transcription) {
      target.speech_transcription = speech.transcription.enabled ? 'enabled' : 'disabled';
      if (speech.transcription.model) {
        target.speech_transcription_model = speech.transcription.model;
      }
    }
  }
}