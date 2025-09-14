import OpenAI from 'openai';
export async function openaiChat(
  prompt: string,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  opts?: { baseURL?: string; apiKeyEnv?: string }
) {
  const apiKey = opts?.apiKeyEnv ? (process.env[opts.apiKeyEnv] as string | undefined) : process.env.OPENAI_API_KEY!;
  const client = new OpenAI({ apiKey: apiKey!, baseURL: opts?.baseURL });
  const started = Date.now();

  // Use Responses API for new models that don't support max_tokens on chat.completions
  const rsp = await client.responses.create({
    model,
    input: prompt,
    temperature: 0.2,
    max_output_tokens: 800
  });

  // Extract text and usage in a version-tolerant way
  const text = (rsp as any).output_text
    || ((rsp as any).choices?.[0]?.message?.content?.trim?.() ?? '')
    || '';

  const u: any = (rsp as any).usage || {};
  const usage = u
    ? {
        inputTokens: u.input_tokens ?? u.prompt_tokens,
        outputTokens: u.output_tokens ?? u.completion_tokens,
        totalTokens: u.total_tokens,
        latencyMs: Date.now() - started
      }
    : undefined;

  return { text, provider: 'openai', model, usage };
}
