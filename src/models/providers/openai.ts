import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import {
  validateResponsesRequest,
  validateResponsesResult,
} from '../../shared/openai/responsesSchemas';
import type { ResponsesRequest, ResponsesResult } from '../../shared/openai/responsesSchemas';
import type { ProviderResponse, ProviderUsage } from './types';
import { isRecord, toNumber } from './types';

type ResponsesUsage = NonNullable<ResponsesResult['usage']>;

const DEFAULT_MAX_OUTPUT_TOKENS = 800;

interface OpenAIChatOptions {
  baseURL?: string;
  apiKeyEnv?: string;
  maxOutputTokens?: number;
}

// Provides a resilient shim over the OpenAI Responses API with a chat.completions fallback
export async function openaiChat(
  prompt: string,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  opts?: OpenAIChatOptions
): Promise<ProviderResponse<'openai'>> {
  const apiKey = resolveApiKey(opts?.apiKeyEnv);
  const client = new OpenAI({ apiKey, baseURL: opts?.baseURL });
  const started = Date.now();

  const requestBase: Partial<ResponsesRequest> & { model: string } = {
    model,
    input: prompt,
    max_output_tokens: normalizedMaxTokens(opts?.maxOutputTokens),
  };
  if (process.env.OPENAI_ALLOW_TEMPERATURE === '1') {
    requestBase.temperature = 0.2;
  }

  const payload = validateResponsesRequest(requestBase);
  const requestPayload = {
    ...payload,
    input: payload.input ?? prompt,
    stream: false as const,
  };

  let rawResponse: unknown;
  try {
    rawResponse = await client.responses.create(requestPayload as unknown as ResponseCreateParamsNonStreaming);
  } catch (error) {
    const fallback = await maybeChatCompletionsFallback({
      client,
      error,
      prompt,
      model,
      maxTokens: normalizedMaxTokens(opts?.maxOutputTokens),
      started,
    });
    if (fallback) return fallback;
    throw error;
  }

  const parsed = validateResponsesResult(rawResponse);
  const text = extractText(parsed, rawResponse) ?? '';
  const usage = buildUsage(parsed.usage, rawResponse, started);

  return { text, provider: 'openai', model, usage };
}

function resolveApiKey(envVar?: string): string {
  if (envVar) {
    const val = process.env[envVar];
    if (typeof val === 'string' && val.trim()) return val;
  }
  const defaultKey = process.env.OPENAI_API_KEY;
  if (typeof defaultKey === 'string' && defaultKey.trim()) return defaultKey;
  throw new Error('OPENAI_API_KEY is not configured');
}

function normalizedMaxTokens(value?: number): number {
  const fallback = DEFAULT_MAX_OUTPUT_TOKENS;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

async function maybeChatCompletionsFallback(params: {
  client: OpenAI;
  error: unknown;
  prompt: string;
  model: string;
  maxTokens: number;
  started: number;
}): Promise<ProviderResponse<'openai'> | null> {
  const { client, error, prompt, model, maxTokens, started } = params;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const unsupported = /Unsupported parameter|not supported with this model/i.test(message);
  if (!unsupported) return null;

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  });

  const text = extractCompletionText(completion) ?? '';
  const usage = buildCompletionUsage(completion.usage, started);

  return { text, provider: 'openai', model, usage };
}

function extractCompletionText(completion: ChatCompletion): string | undefined {
  const choice = completion.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content.trim();
  return undefined;
}

function buildCompletionUsage(usage: ChatCompletion['usage'] | undefined, started: number): ProviderUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? undefined,
    outputTokens: usage.completion_tokens ?? undefined,
    totalTokens: usage.total_tokens ?? undefined,
    latencyMs: Date.now() - started,
  };
}

function extractText(parsed: ResponsesResult, raw: unknown): string | undefined {
  if (Array.isArray(parsed.output)) {
    for (const item of parsed.output) {
      if (!item || typeof item !== 'object') continue;
      if ('type' in item && item.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part || typeof part !== 'object') continue;
          if ('type' in part && part.type === 'output_text' && typeof part.text === 'string') {
            return part.text;
          }
        }
      }
    }
  }

  const legacy = extractLegacyText(raw);
  if (legacy) return legacy;

  return undefined;
}

function extractLegacyText(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.output_text === 'string') return raw.output_text;

  const choices = Array.isArray(raw.choices) ? raw.choices : undefined;
  const firstChoice = choices?.[0];
  if (isRecord(firstChoice)) {
    const message = isRecord(firstChoice.message) ? firstChoice.message : undefined;
    const content = typeof message?.content === 'string' ? message.content : undefined;
    return content?.trim();
  }
  return undefined;
}

function buildUsage(usage: ResponsesUsage | undefined, raw: unknown, started: number): ProviderUsage | undefined {
  const fromResponse = usage
    ? {
        inputTokens: usage.input_tokens ?? undefined,
        outputTokens: usage.output_tokens ?? undefined,
        totalTokens: usage.total_tokens ?? undefined,
        latencyMs: Date.now() - started,
      }
    : undefined;

  if (fromResponse) return fromResponse;

  const legacyUsage = extractLegacyUsage(raw);
  if (!legacyUsage) return undefined;
  return { ...legacyUsage, latencyMs: Date.now() - started };
}

function extractLegacyUsage(raw: unknown): ProviderUsage | undefined {
  if (!isRecord(raw)) return undefined;
  const usage = raw.usage;
  if (!isRecord(usage)) return undefined;

  const inputTokens = toNumber(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = toNumber(usage.output_tokens ?? usage.completion_tokens);
  const totalTokens = toNumber(usage.total_tokens);

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}
