import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import type { ProviderResponse } from './types';

const DEFAULT_MAX_TOKENS = 800;

export async function claudeChat(
  prompt: string,
  model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  maxOutputTokens: number = DEFAULT_MAX_TOKENS,
): Promise<ProviderResponse<'anthropic'>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const client = new Anthropic({ apiKey });
  const started = Date.now();
  const params: MessageCreateParamsNonStreaming = {
    model,
    max_tokens: Math.max(1, Number(maxOutputTokens || DEFAULT_MAX_TOKENS)),
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  };

  const response = await client.messages.create(params);

  const text = extractText(response) ?? '';
  const usage = extractUsage(response, started);

  return { text, provider: 'anthropic', model, usage };
}

function extractText(response: Message): string | undefined {
  const first = Array.isArray(response.content) ? response.content[0] : undefined;
  if (first && typeof first === 'object' && first !== null && 'text' in first) {
    const text = (first as { text?: unknown }).text;
    if (typeof text === 'string') return text.trim();
  }
  return undefined;
}

function extractUsage(
  response: Message,
  started: number,
): ProviderResponse<'anthropic'>['usage'] {
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  if (!usage) return undefined;
  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined;
  const totalTokens =
    inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs: Date.now() - started,
  };
}
