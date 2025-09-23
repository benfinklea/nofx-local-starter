import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProviderResponse } from './types';
import { isRecord, toNumber } from './types';

export async function geminiChat(
  prompt: string,
  model = process.env.GEMINI_MODEL || 'gemini-2.5-pro',
): Promise<ProviderResponse<'gemini'>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const genai = new GoogleGenerativeAI(apiKey);
  const modelRef = genai.getGenerativeModel({ model });
  const started = Date.now();
  const response = await modelRef.generateContent(prompt);

  const text = extractText(response) ?? '';
  const usage = extractUsage(response, started);

  return { text, provider: 'gemini', model, usage };
}

type GenerateContentResponse = Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>;

function extractText(response: GenerateContentResponse): string | undefined {
  const textFn = response.response?.text?.bind(response.response);
  if (typeof textFn === 'function') {
    const raw = textFn();
    if (typeof raw === 'string') return raw.trim();
  }
  return undefined;
}

function extractUsage(
  response: GenerateContentResponse,
  started: number,
): ProviderResponse<'gemini'>['usage'] {
  const usageMetadata = isRecord(response.response) ? response.response.usageMetadata : undefined;
  if (!isRecord(usageMetadata)) return undefined;

  const inputTokens = toNumber(usageMetadata.promptTokenCount);
  const outputTokens = toNumber(usageMetadata.candidatesTokenCount);
  const totalTokens = toNumber(usageMetadata.totalTokenCount) ?? (
    inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined
  );

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs: Date.now() - started,
  };
}
