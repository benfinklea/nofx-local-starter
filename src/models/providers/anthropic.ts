import Anthropic from '@anthropic-ai/sdk';
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
  const response = await client.messages.create({
    model,
    max_tokens: Math.max(1, Number(maxOutputTokens || DEFAULT_MAX_TOKENS)),
    messages: [{ role: 'user', content: prompt }],
  });

  const text = extractText(response) ?? '';
  const usage = extractUsage(response, started);

  return { text, provider: 'anthropic', model, usage };
}

type MessageResponse = Awaited<ReturnType<Anthropic['messages']['create']>>;

function extractText(response: MessageResponse): string | undefined {
  const first = Array.isArray(response.content) ? response.content[0] : undefined;
  if (first && typeof first === 'object' && first !== null && 'text' in first) {
    const text = (first as { text?: unknown }).text;
    if (typeof text === 'string') return text.trim();
  }
  return undefined;
}

function extractUsage(
  response: MessageResponse,
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
