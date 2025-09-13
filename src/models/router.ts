import { openaiChat } from './providers/openai';
import { claudeChat } from './providers/anthropic';
import { geminiChat } from './providers/gemini';

export type TaskKind = 'codegen'|'reasoning'|'docs';

export async function routeLLM(kind: TaskKind, prompt: string){
  const order = pickOrder(kind);
  let lastErr: any;
  for (const p of order) {
    try {
      const out = await call(p, prompt);
      return out;
    } catch (e:any) { lastErr = e; }
  }
  throw lastErr || new Error('no provider succeeded');
}
function pickOrder(kind: TaskKind): Array<'openai'|'anthropic'|'gemini'> {
  const pref = (process.env.LLM_ORDER || '').split(',').filter(Boolean) as any[];
  if (pref.length) return pref;
  if (kind === 'codegen') return ['openai','anthropic','gemini'];
  if (kind === 'reasoning') return ['anthropic','openai','gemini'];
  return ['gemini','anthropic','openai'];
}
function call(p: string, prompt: string){
  if (p==='openai') return openaiChat(prompt);
  if (p==='anthropic') return claudeChat(prompt);
  if (p==='gemini') return geminiChat(prompt);
  throw new Error('unknown provider ' + p);
}