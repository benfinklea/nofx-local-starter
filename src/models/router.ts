import { openaiChat } from './providers/openai';
import { claudeChat } from './providers/anthropic';
import { geminiChat } from './providers/gemini';
import { getSettings } from '../lib/settings';
import { httpChat } from './providers/http';
import { getModelByName } from '../lib/models';

export type TaskKind = 'codegen'|'reasoning'|'docs';

export async function routeLLM(kind: TaskKind, prompt: string){
  const { llm } = await getSettings();
  const modelOrder = llm?.modelOrder?.[kind as 'docs'|'reasoning'|'codegen'] || [];
  let lastErr: any;
  if (modelOrder.length) {
    for (const name of modelOrder) {
      try {
        const m = await getModelByName(name);
        if (!m || m.active === false) continue;
        const out: any = await callModelWithRetry(m, prompt);
        if (typeof out === 'string') return out;
        return { ...out, provider: m.provider, model: m.name };
      } catch (e:any) { lastErr = e; }
    }
    throw lastErr || new Error('no model succeeded');
  }
  const order = await pickOrder(kind);
  for (const p of order) {
    try {
      const model = (p==='openai' ? process.env.OPENAI_MODEL : p==='anthropic' ? process.env.ANTHROPIC_MODEL : p==='gemini' ? process.env.GEMINI_MODEL : undefined);
      const out = await callWithRetry(p, prompt, model as any);
      return out;
    } catch (e:any) { lastErr = e; }
  }
  throw lastErr || new Error('no provider succeeded');
}
async function pickOrder(kind: TaskKind): Promise<Array<'openai'|'anthropic'|'gemini'>> {
  const envPref = (process.env.LLM_ORDER || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean) as any[];
  if (envPref.length) return envPref as any;
  try {
    const { llm } = await getSettings();
    const order = llm?.order?.[kind as 'docs'|'reasoning'|'codegen'];
    if (Array.isArray(order) && order.length) return order as any;
  } catch {}
  if (kind === 'codegen') return ['openai','anthropic','gemini'];
  if (kind === 'reasoning') return ['anthropic','openai','gemini'];
  return ['gemini','anthropic','openai'];
}
function call(p: string, prompt: string, model?: string, custom?: any){
  if (p==='openai') return openaiChat(prompt, model);
  if (p==='anthropic') return claudeChat(prompt, model);
  if (p==='gemini') return geminiChat(prompt, model);
  if (custom && custom.kind === 'openai-compatible') {
    const baseURL = custom.baseUrl || process.env[`LLM_${p.toUpperCase()}_BASE_URL`];
    const apiKeyEnv = process.env[`LLM_${p.toUpperCase()}_API_KEY`] ? `LLM_${p.toUpperCase()}_API_KEY` : undefined;
    return openaiChat(prompt, model, { baseURL, apiKeyEnv });
  }
  if (custom && custom.kind === 'http') {
    const endpoint = custom.baseUrl || process.env[`LLM_${p.toUpperCase()}_BASE_URL`];
    if (!endpoint) throw new Error('http provider missing baseUrl');
    const apiKeyEnv = process.env[`LLM_${p.toUpperCase()}_API_KEY`] ? `LLM_${p.toUpperCase()}_API_KEY` : undefined;
    return httpChat(prompt, endpoint, apiKeyEnv, model);
  }
  throw new Error('unknown provider ' + p);
}

async function callWithRetry(p: string, prompt: string, model: string|undefined, retries=2, timeoutMs=15000){
  let lastErr: any;
  for (let attempt=0; attempt<=retries; attempt++){
    try {
      const { llm } = await getSettings();
      const custom = llm?.providers ? (llm.providers as any)[p] : undefined;
      const res = await withTimeout(call(p, prompt, model, custom), timeoutMs);
      return res;
    } catch (e:any) {
      lastErr = e;
      await delay((attempt+1)*250);
    }
  }
  throw lastErr;
}

async function callModelWithRetry(m: { kind: string; base_url?: string; provider: string; name: string }, prompt: string, retries=2, timeoutMs=15000){
  let lastErr: any;
  for (let attempt=0; attempt<=retries; attempt++){
    try {
      const res = await withTimeout(callModel(m, prompt), timeoutMs);
      return res;
    } catch (e:any) {
      lastErr = e;
      await delay((attempt+1)*250);
    }
  }
  throw lastErr;
}

function callModel(m: { kind: string; base_url?: string; provider: string; name: string }, prompt: string){
  const kind = (m.kind || '').toLowerCase();
  if (kind === 'openai') return openaiChat(prompt, m.name);
  if (kind === 'anthropic') return claudeChat(prompt, m.name);
  if (kind === 'gemini') return geminiChat(prompt, m.name);
  if (kind === 'openai-compatible') {
    const apiKeyEnv = `LLM_${m.provider.toUpperCase()}_API_KEY`;
    return openaiChat(prompt, m.name, { baseURL: m.base_url, apiKeyEnv });
  }
  if (kind === 'http') {
    const apiKeyEnv = `LLM_${m.provider.toUpperCase()}_API_KEY`;
    if (!m.base_url) throw new Error('http model missing base_url');
    return httpChat(prompt, m.base_url, apiKeyEnv, m.name);
  }
  throw new Error('unknown model kind ' + kind);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('llm timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}

function delay(ms:number){ return new Promise(r=>setTimeout(r, ms)); }
