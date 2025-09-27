import crypto from 'node:crypto';
import type { ModelRow } from '../lib/models';
import { getModelByName } from '../lib/models';
import { getSettings } from '../lib/settings';
import { metrics } from '../lib/metrics';
import { setContext } from '../lib/observability';
import { getCacheJSON, setCacheJSON } from '../lib/cache';
import { claudeChat } from './providers/anthropic';
import { geminiChat } from './providers/gemini';
import { httpChat } from './providers/http';
import { openaiChat } from './providers/openai';
import type {
  CoreProvider,
  ProviderConfig,
  ProviderConfigMap,
  RouteResult,
} from './providers/types';

export type TaskKind = 'codegen' | 'reasoning' | 'docs';
export type RouteOpts = { maxOutputTokens?: number };

const RETRY_DELAY_STEP_MS = 250;

export async function routeLLM(kind: TaskKind, prompt: string, opts?: RouteOpts): Promise<RouteResult> {
  const { llm } = await getSettings();
  const providerConfigs: ProviderConfigMap = llm.providers ?? {};
  const modelOrder = llm.modelOrder?.[kind] ?? [];
  let lastErr: unknown;

  if (modelOrder.length) {
    for (const name of modelOrder) {
      try {
        const model = await getModelByName(name);
        if (!model || model.active === false) continue;
        const cached = await maybeGetDocsCache(kind, prompt, model.name);
        if (cached) return cached;
        const result = await callModelWithRetry(model, prompt, opts);
        await maybeSetDocsCache(kind, prompt, model.name, result);
        if (typeof result === 'string') return result;
        return { ...result, provider: model.provider, model: model.name };
      } catch (error) {
        lastErr = error;
      }
    }
    throw (lastErr as Error) || new Error(`No models available for task '${kind}'. Tried models: ${modelOrder.join(', ')}. Check model configuration and ensure at least one model is active.`);
  }

  const order = await pickOrder(kind);
  for (const provider of order) {
    try {
      setContextSafe({ provider });
      const modelName = resolvePreferredModel(provider);
      if (kind === 'docs') {
        const cached = await maybeGetDocsCache(kind, prompt, modelName ?? provider);
        if (cached) return cached;
      }
      const result = await callWithRetry(provider, prompt, modelName, providerConfigs, 2, 15_000, opts);
      if (kind === 'docs') {
        await maybeSetDocsCache(kind, prompt, modelName ?? provider, result);
      }
      return result;
    } catch (error) {
      lastErr = error;
    }
  }

  throw (lastErr as Error) || new Error(`All providers failed for task '${kind}'. Tried providers: ${order.join(', ')}. Check provider configurations and API keys.`);
}

async function pickOrder(kind: TaskKind): Promise<CoreProvider[]> {
  const envPref = (process.env.LLM_ORDER || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is CoreProvider => value === 'openai' || value === 'anthropic' || value === 'gemini');
  if (envPref.length) return envPref;

  try {
    const { llm } = await getSettings();
    const order = llm.order?.[kind];
    if (Array.isArray(order) && order.length) return order;
  } catch {
    // ignore and fall back to defaults
  }

  if (kind === 'codegen') return ['openai', 'anthropic', 'gemini'];
  if (kind === 'reasoning') return ['anthropic', 'openai', 'gemini'];
  return ['gemini', 'anthropic', 'openai'];
}

function call(
  provider: string,
  prompt: string,
  model: string | undefined,
  customConfig: ProviderConfig | undefined,
  opts?: RouteOpts,
): Promise<RouteResult> {
  if (provider === 'openai') {
    return openaiChat(prompt, model, { maxOutputTokens: opts?.maxOutputTokens });
  }
  if (provider === 'anthropic') {
    return claudeChat(prompt, model, opts?.maxOutputTokens);
  }
  if (provider === 'gemini') {
    return geminiChat(prompt, model);
  }

  if (customConfig && isOpenAICompatibleConfig(customConfig)) {
    const baseURL = customConfig.baseUrl || resolveEnvBaseUrl(provider);
    const apiKeyEnv = resolveProviderApiKeyEnv(provider);
    return openaiChat(prompt, model, { baseURL, apiKeyEnv, maxOutputTokens: opts?.maxOutputTokens });
  }

  if (customConfig && isHttpConfig(customConfig)) {
    const endpoint = customConfig.baseUrl || resolveEnvBaseUrl(provider);
    if (!endpoint) throw new Error(`HTTP provider '${provider}' missing baseUrl. Set baseUrl in provider config or environment variable LLM_${provider.toUpperCase()}_BASE_URL.`);
    const apiKeyEnv = resolveProviderApiKeyEnv(provider);
    return httpChat(prompt, endpoint, apiKeyEnv, model);
  }

  throw new Error(`Unknown provider '${provider}'. Supported providers: anthropic, openai, gemini, http. Check your provider configuration.`);
}

async function callWithRetry(
  provider: string,
  prompt: string,
  model: string | undefined,
  providerConfigs: ProviderConfigMap,
  retries = 2,
  timeoutMs = 15_000,
  opts?: RouteOpts,
): Promise<RouteResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const custom = providerConfigs[provider];
      setContextSafe({ retryCount: attempt });
      if (attempt > 0) {
        incrementRetryMetric(provider);
      }
      return await withTimeout(call(provider, prompt, model, custom, opts), timeoutMs);
    } catch (error) {
      lastErr = error;
      await delay((attempt + 1) * RETRY_DELAY_STEP_MS);
    }
  }
  throw (lastErr as Error) || new Error(`retry exhausted for provider ${provider}`);
}

async function callModelWithRetry(
  model: ModelRow,
  prompt: string,
  opts?: RouteOpts,
  retries = 2,
  timeoutMs = 15_000,
): Promise<RouteResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      setContextSafe({ provider: model.provider });
      setContextSafe({ retryCount: attempt });
      if (attempt > 0) {
        incrementRetryMetric(model.provider);
      }
      return await withTimeout(callModel(model, prompt, opts), timeoutMs);
    } catch (error) {
      lastErr = error;
      await delay((attempt + 1) * RETRY_DELAY_STEP_MS);
    }
  }
  throw (lastErr as Error) || new Error(`retry exhausted for model ${model.name}`);
}

function callModel(model: ModelRow, prompt: string, opts?: RouteOpts): Promise<RouteResult> {
  const kind = (model.kind || '').toLowerCase();
  if (kind === 'openai') {
    return openaiChat(prompt, model.name, { maxOutputTokens: opts?.maxOutputTokens });
  }
  if (kind === 'anthropic') {
    return claudeChat(prompt, model.name, opts?.maxOutputTokens);
  }
  if (kind === 'gemini') {
    return geminiChat(prompt, model.name);
  }
  if (kind === 'openai-compatible') {
    const apiKeyEnv = `LLM_${model.provider.toUpperCase()}_API_KEY`;
    return openaiChat(prompt, model.name, {
      baseURL: model.base_url,
      apiKeyEnv,
      maxOutputTokens: opts?.maxOutputTokens,
    });
  }
  if (kind === 'http') {
    const apiKeyEnv = `LLM_${model.provider.toUpperCase()}_API_KEY`;
    if (!model.base_url) throw new Error('http model missing base_url');
    return httpChat(prompt, model.base_url, apiKeyEnv, model.name);
  }
  throw new Error(`unknown model kind ${model.kind}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('llm timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(kind: TaskKind, prompt: string, model: string): string {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 24);
  return `${kind}:${model}:${hash}`;
}

async function maybeGetDocsCache(kind: TaskKind, prompt: string, model: string | undefined): Promise<RouteResult | undefined> {
  if (kind !== 'docs') return undefined;
  const ttlMs = Math.max(0, Number(process.env.DOCS_CACHE_TTL_MS || 10 * 60 * 1000));
  if (ttlMs === 0) return undefined;
  const key = cacheKey(kind, prompt, model || 'default');
  const cached = await getCacheJSON<RouteResult>('llm', key);
  return cached ?? undefined;
}

async function maybeSetDocsCache(kind: TaskKind, prompt: string, model: string | undefined, value: RouteResult): Promise<void> {
  if (kind !== 'docs') return;
  const ttlMs = Math.max(0, Number(process.env.DOCS_CACHE_TTL_MS || 10 * 60 * 1000));
  if (ttlMs === 0) return;
  const key = cacheKey(kind, prompt, model || 'default');
  await setCacheJSON('llm', key, value, ttlMs).catch(() => {});
}

function resolvePreferredModel(provider: CoreProvider): string | undefined {
  const raw = provider === 'openai'
    ? process.env.OPENAI_MODEL
    : provider === 'anthropic'
      ? process.env.ANTHROPIC_MODEL
      : provider === 'gemini'
        ? process.env.GEMINI_MODEL
        : undefined;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveEnvBaseUrl(provider: string): string | undefined {
  const key = `LLM_${provider.toUpperCase()}_BASE_URL`;
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function resolveProviderApiKeyEnv(provider: string): string | undefined {
  const key = `LLM_${provider.toUpperCase()}_API_KEY`;
  return typeof process.env[key] === 'string' ? key : undefined;
}

function isOpenAICompatibleConfig(config: ProviderConfig): config is ProviderConfig & { kind: 'openai-compatible' } {
  return config.kind === 'openai-compatible';
}

function isHttpConfig(config: ProviderConfig): config is ProviderConfig & { kind: 'http' } {
  return config.kind === 'http';
}

function setContextSafe(values: Record<string, unknown>): void {
  try {
    setContext(values);
  } catch {
    // observability is optional during tests
  }
}

function incrementRetryMetric(provider: string): void {
  try {
    metrics.retriesTotal.inc({ provider });
  } catch {
    // metrics are best-effort
  }
}
