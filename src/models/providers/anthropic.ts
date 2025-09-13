import Anthropic from '@anthropic-ai/sdk';
export async function claudeChat(prompt: string, model=process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'){
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const started = Date.now();
  const rsp = await client.messages.create({ model, max_tokens:800, messages:[{role:'user', content: prompt}]});
  const txt = (rsp.content[0] as any)?.text || '';
  const usage = (rsp as any).usage ? {
    inputTokens: (rsp as any).usage.input_tokens,
    outputTokens: (rsp as any).usage.output_tokens,
    totalTokens: ((rsp as any).usage.input_tokens || 0) + ((rsp as any).usage.output_tokens || 0),
    latencyMs: Date.now() - started
  } : undefined;
  return { text: txt.trim(), provider: 'anthropic', model, usage };
}
