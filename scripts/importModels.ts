import dotenv from 'dotenv';
dotenv.config();
import { upsertModel } from '../src/lib/models';

async function main(){
  const which = (process.argv[2] || '').toLowerCase();
  if (!which) {
    console.error('Usage: ts-node scripts/importModels.ts <openai|anthropic|gemini>');
    process.exit(2);
  }
  if (which === 'openai') return importOpenAI();
  if (which === 'anthropic') return importAnthropic();
  if (which === 'gemini') return importGemini();
  console.error('Unknown vendor');
  process.exit(2);
}

async function importOpenAI(){
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const list = await client.models.list();
  for (const m of list.data) {
    const name = m.id;
    // Heuristic: skip embeddings/audio
    if (/embedding|whisper|tts|audio|vision/.test(name)) continue;
    await upsertModel({ provider:'openai', name, kind:'openai', display_name:name });
  }
  console.log('Imported OpenAI models');
}
async function importAnthropic(){
  // Anthropic does not expose a list API; seed common models. Update as needed.
  const names = ['claude-3-5-sonnet-latest','claude-3-opus-latest','claude-3-haiku-latest'];
  for (const name of names) await upsertModel({ provider:'anthropic', name, kind:'anthropic', display_name:name });
  console.log('Seeded Anthropic models');
}
async function importGemini(){
  // Gemini list via HTTP requires auth and parsing; seed common identifiers.
  const names = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
  ];
  for (const name of names) await upsertModel({ provider:'gemini', name, kind:'gemini', display_name:name });
  console.log('Seeded Gemini models');
}

main().catch(e=>{ console.error(e); process.exit(1); });
