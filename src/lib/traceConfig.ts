import path from 'node:path';
import fs from 'node:fs';
import { getSettings, updateSettings } from './settings';

type TraceCache = {
  value: boolean;
  source: 'env' | 'settings' | 'default';
  expiresAt: number;
};

type TraceGlobal = {
  cache: TraceCache | null;
  loading: Promise<void> | null;
};

const GLOBAL_KEY = '__NOFX_TRACE_LOG_CACHE__';

function getGlobal(): TraceGlobal {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: TraceGlobal };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { cache: null, loading: null };
  }
  return g[GLOBAL_KEY]!;
}

function envOverride(): TraceCache | null {
  const raw = process.env.RUN_TRACE_LOG || process.env.NOFX_TRACE_LOG;
  if (!raw) return null;
  const value = raw.toLowerCase() === 'true';
  return { value, source: 'env', expiresAt: Number.MAX_SAFE_INTEGER };
}

async function loadFromSettings(): Promise<void> {
  const global = getGlobal();
  try {
    const settings = await getSettings();
    const value = Boolean(settings.ops?.traceLoggingEnabled);
    global.cache = { value, source: 'settings', expiresAt: Date.now() + 15_000 };
  } catch {
    global.cache = { value: false, source: 'default', expiresAt: Date.now() + 5_000 };
  }
}

function scheduleLoadIfNeeded(): void {
  const global = getGlobal();
  if (global.loading) return;
  global.loading = loadFromSettings().finally(() => {
    const state = getGlobal();
    state.loading = null;
  });
}

export function getTraceStatusSync(): { value: boolean; source: 'env' | 'settings' | 'default' } {
  const env = envOverride();
  if (env) {
    const global = getGlobal();
    global.cache = env;
    return { value: env.value, source: env.source };
  }

  const global = getGlobal();
  if (!global.cache || global.cache.expiresAt < Date.now()) {
    scheduleLoadIfNeeded();
  }

  return {
    value: global.cache?.value ?? false,
    source: global.cache?.source ?? 'default'
  };
}

export async function refreshTraceStatus(): Promise<{ value: boolean; source: 'env' | 'settings' | 'default' }> {
  const env = envOverride();
  if (env) {
    const global = getGlobal();
    global.cache = env;
    return { value: env.value, source: env.source };
  }

  await loadFromSettings();
  const global = getGlobal();
  return {
    value: global.cache?.value ?? false,
    source: global.cache?.source ?? 'default'
  };
}

export async function setTraceLogging(enabled: boolean): Promise<void> {
  const global = getGlobal();
  global.cache = { value: enabled, source: 'settings', expiresAt: Date.now() + 15_000 };
  await updateSettings({ ops: { traceLoggingEnabled: enabled } });
}

export function logFilePath(): string {
  const dir = process.env.LOG_FILE_DIR || path.join(process.cwd(), 'local_data', 'logs');
  return process.env.LOG_FILE_PATH || path.join(dir, 'nofx-trace.log');
}

export function logFileExists(): boolean {
  try {
    const file = logFilePath();
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

export function clearTraceCache(): void {
  const global = getGlobal();
  global.cache = null;
}
