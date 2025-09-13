import Anthropic from '@anthropic-ai/sdk';
export async function claudeChat(prompt: string, model=process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'){
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const rsp = await client.messages.create({ model, max_tokens:800, messages:[{role:'user', content: prompt}]});
  const txt = (rsp.content[0] as any)?.text || '';
  return txt.trim();
}