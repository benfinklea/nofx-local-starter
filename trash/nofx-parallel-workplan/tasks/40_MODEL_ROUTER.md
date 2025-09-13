# 40_MODEL_ROUTER — Provider adapters + router + integration

**Depends on:** 00_BASE

## Files to add
- `src/models/providers/openai.ts`
- `src/models/providers/anthropic.ts`
- `src/models/providers/gemini.ts`
- `src/models/router.ts`
- Update `src/tools/codegen.ts` to use router

### 1) Providers
`src/models/providers/openai.ts`
```ts
import OpenAI from 'openai';
export async function openaiChat(prompt: string, model=process.env.OPENAI_MODEL || 'gpt-4o-mini') {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const rsp = await client.chat.completions.create({ model, messages:[{role:'user',content:prompt}], temperature:0.2, max_tokens:800 });
  return rsp.choices[0]?.message?.content?.trim() || '';
}
```

`src/models/providers/anthropic.ts`
```ts
import Anthropic from '@anthropic-ai/sdk';
export async function claudeChat(prompt: string, model=process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'){
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const rsp = await client.messages.create({ model, max_tokens:800, messages:[{role:'user', content: prompt}]});
  const txt = (rsp.content[0] as any)?.text || '';
  return txt.trim();
}
```

`src/models/providers/gemini.ts`
```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
export async function geminiChat(prompt: string, model=process.env.GEMINI_MODEL || 'gemini-1.5-pro'){
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelRef = genai.getGenerativeModel({ model });
  const rsp = await modelRef.generateContent(prompt);
  return rsp.response.text().trim();
}
```

### 2) Router
`src/models/router.ts`
```ts
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
```

### 3) Integrate in codegen tool
**Edit `src/tools/codegen.ts`** to use router when keys exist:
```ts
import { routeLLM } from "../models/router";
import { log } from "../lib/logger";

export async function codegenReadme(inputs: { topic?: string; bullets?: string[] } = {}): Promise<string> {
  const topic = inputs.topic || "NOFX";
  const bullets = inputs.bullets || ["Control plane", "Verification", "Workers"];
  const hasKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  if (!hasKeys) {
    log.warn("No provider keys set; returning stub content");
    return `# ${topic}\n\n- ${bullets.join("\n- ")}\n\n_Generated locally without LLM._\n`;
  }
  const prompt = `Write a concise README section titled "${topic}" with bullet points: ${bullets.join(", ")}. Keep it tight.`;
  return await routeLLM('docs', prompt);
}
```

## Done
Commit: `feat(models): add provider router and wire into codegen`
