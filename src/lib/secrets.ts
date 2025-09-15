import fs from 'node:fs';
import path from 'node:path';

export type SecretOptions = {
  runId: string;
  scope?: string; // e.g., 'github', 'llm', 'deploy'
  allowEnv?: boolean;
  envAllowed?: string[]; // whitelist of env names when falling back to process.env
};

function readJsonSafe(file: string): any {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function loadScopedSecrets(runId: string, scope?: string): Record<string,string> {
  const base = path.join(process.cwd(), 'local_data', 'secrets');
  const out: Record<string,string> = {};
  if (!scope) return out;
  const files = [
    path.join(base, `${runId}.${scope}.json`), // most specific (per-run)
    path.join(base, `${scope}.json`)          // default for scope
  ];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const obj = readJsonSafe(f) || {};
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'string' && !(k in out)) out[k] = String(obj[k]);
      }
    }
  }
  return out;
}

export function getSecret(name: string, opts: SecretOptions): string | undefined {
  const scoped = loadScopedSecrets(opts.runId, opts.scope);
  if (scoped && typeof scoped[name] === 'string') return scoped[name];
  if (opts.allowEnv) {
    if (Array.isArray(opts.envAllowed) && opts.envAllowed.length > 0) {
      if (!opts.envAllowed.includes(name)) return undefined;
    }
    return process.env[name];
  }
  return undefined;
}

export function buildMinimalEnv(envAllowed?: string[]): NodeJS.ProcessEnv {
  const baseAllow = new Set(['PATH','HOME','USER','SHELL','TMP','TEMP','PWD','NODE_ENV','TZ','LANG','LC_ALL']);
  const allow = new Set([...(envAllowed || []), ...baseAllow]);
  const out: NodeJS.ProcessEnv = {};
  for (const k of allow) {
    const v = process.env[String(k)];
    if (v != null) out[String(k)] = v;
  }
  return out;
}

