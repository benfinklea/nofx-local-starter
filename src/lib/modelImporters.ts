import { upsertModel } from './models';

export async function importOpenAIModels(opts?: { apiKey?: string; filter?: string[]; exclude?: string[]; recommendedOnly?: boolean }){
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: (opts?.apiKey || process.env.OPENAI_API_KEY!) });
  const list = await client.models.list();
  let n = 0;
  const filters = (opts?.filter || []).map(s => s.toLowerCase()).filter(Boolean);
  const excludes = (opts?.exclude || []).map(s => s.toLowerCase()).filter(Boolean);
  // Recommended list: only GPT-5 family by default
  const recommended = new Set([
    'gpt-5',       // matches gpt-5, gpt-5-*, gpt-5.*
    'gpt-5-mini'
  ]);
  for (const m of list.data) {
    const name = m.id;
    if (typeof name !== 'string') continue;
    const lname = name.toLowerCase();
    // Default skip clutter
    if (/embedding|whisper|tts|audio|realtime|vision|omni|fine-tune|moderation|responses|batch/.test(lname)) continue;
    // If recommendedOnly and no explicit filters, only import curated prefixes
    if ((opts?.recommendedOnly && filters.length === 0)) {
      if (![...recommended].some(r => lname.startsWith(r))) continue;
    }
    if (filters.length && !filters.some(f => lname.includes(f))) continue;
    if (excludes.length && excludes.some(x => lname.includes(x))) continue;
    await upsertModel({ provider:'openai', name, kind:'openai', display_name:name });
    n++;
  }
  return { imported: n };
}

export async function listOpenAIModels(opts?: { apiKey?: string; filter?: string[]; exclude?: string[]; recommendedOnly?: boolean }): Promise<string[]> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: (opts?.apiKey || process.env.OPENAI_API_KEY!) });
  const list = await client.models.list();
  const filters = (opts?.filter || []).map(s => s.toLowerCase()).filter(Boolean);
  const excludes = (opts?.exclude || []).map(s => s.toLowerCase()).filter(Boolean);
  const recommended = new Set([
    'gpt-5',
    'gpt-5-mini'
  ]);
  const out: string[] = [];
  for (const m of list.data) {
    const name = m.id;
    if (typeof name !== 'string') continue;
    const lname = name.toLowerCase();
    if (/embedding|whisper|tts|audio|realtime|vision|omni|fine-tune|moderation|responses|batch/.test(lname)) continue;
    if ((opts?.recommendedOnly && (!filters || filters.length === 0))) {
      if (![...recommended].some(r => lname.startsWith(r))) continue;
    }
    if (filters.length && !filters.some(f => lname.includes(f))) continue;
    if (excludes.length && excludes.some(x => lname.includes(x))) continue;
    out.push(name);
  }
  return out;
}

export async function seedAnthropicModels(){
  const names = [
    // Current common Anthropic chat models
    'claude-3-5-sonnet-latest',
    'claude-3-opus-latest',
    'claude-3-haiku-latest',
    // Newer series (user-requested entries)
    'opus-4.1',
    'sonnet-4',
    'haiku-3.5'
  ];
  let n = 0;
  for (const name of names) {
    await upsertModel({ provider:'anthropic', name, kind:'anthropic', display_name:name });
    n++;
  }
  return { imported: n };
}

export async function seedGeminiModels(){
  const names = [
    // Prefer 2.5 series
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    // Keep some 1.5 identifiers for compatibility
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
  ];
  let n = 0;
  for (const name of names) {
    await upsertModel({ provider:'gemini', name, kind:'gemini', display_name:name });
    n++;
  }
  return { imported: n };
}
