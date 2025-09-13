import { upsertModel } from './models';

export async function importOpenAIModels(apiKey?: string){
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY! });
  const list = await client.models.list();
  let n = 0;
  for (const m of list.data) {
    const name = m.id;
    if (typeof name !== 'string') continue;
    // Skip obviously non-chat models by name
    if (/embedding|whisper|tts|audio|vision|fine-tune|moderation/i.test(name)) continue;
    await upsertModel({ provider:'openai', name, kind:'openai', display_name:name });
    n++;
  }
  return { imported: n };
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
