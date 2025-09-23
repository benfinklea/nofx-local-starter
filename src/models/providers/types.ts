export type CoreProvider = 'openai' | 'anthropic' | 'gemini';

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export interface ProviderResponse<TProvider extends string = CoreProvider> {
  text: string;
  provider: TProvider;
  model: string;
  usage?: ProviderUsage;
}

export type RouteResult = ProviderResponse | string;

type BaseProviderConfig = {
  baseUrl?: string;
  [key: string]: unknown;
};

export interface OpenAICompatibleProviderConfig extends BaseProviderConfig {
  kind: 'openai-compatible';
}

export interface HttpProviderConfig extends BaseProviderConfig {
  kind: 'http';
}

export interface NativeProviderConfig extends BaseProviderConfig {
  kind: 'openai' | 'anthropic' | 'gemini';
}

export type ProviderConfig =
  | OpenAICompatibleProviderConfig
  | HttpProviderConfig
  | NativeProviderConfig;

export type ProviderConfigMap = Record<string, ProviderConfig | undefined>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

