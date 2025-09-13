import OpenAI from 'openai';
export async function openaiChat(prompt: string, model=process.env.OPENAI_MODEL || 'gpt-4o-mini') {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const rsp = await client.chat.completions.create({ model, messages:[{role:'user',content:prompt}], temperature:0.2, max_tokens:800 });
  return rsp.choices[0]?.message?.content?.trim() || '';
}