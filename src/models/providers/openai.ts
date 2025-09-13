import OpenAI from 'openai';
export async function openaiChat(prompt: string, model=process.env.OPENAI_MODEL || 'gpt-4o-mini', opts?: { baseURL?: string, apiKeyEnv?: string }) {
  const apiKey = opts?.apiKeyEnv ? (process.env[opts.apiKeyEnv] as string|undefined) : process.env.OPENAI_API_KEY!;
  const client = new OpenAI({ apiKey: apiKey!, baseURL: opts?.baseURL });
  const started = Date.now();
  const rsp = await client.chat.completions.create({ model, messages:[{role:'user',content:prompt}], temperature:0.2, max_tokens:800 });
  const text = rsp.choices[0]?.message?.content?.trim() || '';
  const usage = rsp.usage ? {
    inputTokens: rsp.usage.prompt_tokens,
    outputTokens: rsp.usage.completion_tokens,
    totalTokens: rsp.usage.total_tokens,
    latencyMs: Date.now() - started
  } : undefined;
  return { text, provider: 'openai', model, usage };
}
