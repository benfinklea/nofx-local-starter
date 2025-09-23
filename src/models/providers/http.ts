import type { ProviderResponse, ProviderUsage } from './types';
import { isRecord, toNumber } from './types';

export async function httpChat(
  prompt: string,
  endpoint: string,
  apiKeyEnv?: string,
  model?: string,
): Promise<ProviderResponse<string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = resolveApiKey(apiKeyEnv);
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model }),
  });

  if (!response.ok) {
    throw new Error(`http provider ${endpoint} status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractText(payload) ?? '';
  const usage = extractUsage(payload);

  return { text, provider: endpoint, model: model ?? endpoint, usage };
}

function resolveApiKey(envVar?: string): string | undefined {
  if (!envVar) return undefined;
  const value = process.env[envVar];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function extractText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.output === 'string') return payload.output;
  return undefined;
}

function extractUsage(payload: unknown): ProviderUsage | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) return undefined;
  const usage = payload.usage;
  const inputTokens = toNumber(usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = toNumber(usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens);
  const totalTokens = toNumber(usage.totalTokens ?? usage.total_tokens);

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

