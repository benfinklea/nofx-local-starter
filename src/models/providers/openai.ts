import OpenAI from 'openai';
export async function openaiChat(
  prompt: string,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  opts?: { baseURL?: string; apiKeyEnv?: string; maxOutputTokens?: number }
) {
  const apiKey = opts?.apiKeyEnv ? (process.env[opts.apiKeyEnv] as string | undefined) : process.env.OPENAI_API_KEY!;
  const client = new OpenAI({ apiKey: apiKey!, baseURL: opts?.baseURL });
  const started = Date.now();

  // Use Responses API for new models that don't support max_tokens on chat.completions
  // Build minimal payload for broadest compatibility across models
  const payload: any = { model, input: prompt, max_output_tokens: Math.max(1, Number(opts?.maxOutputTokens ?? 800)) };
  // Only include temperature when explicitly allowed via env
  if (process.env.OPENAI_ALLOW_TEMPERATURE === '1') payload.temperature = 0.2;
  let rsp: any;
  try {
    rsp = await client.responses.create(payload);
  } catch (e: any) {
    const msg = String(e?.message || '');
    const unsupported = /Unsupported parameter|not supported with this model/i.test(msg);
    if (!unsupported) throw e;
    // Fallback to Chat Completions for older/edge models
    const cc = await (client as any).chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: Math.max(1, Number(opts?.maxOutputTokens ?? 800))
    });
    const text = (cc as any).choices?.[0]?.message?.content?.trim?.() ?? '';
    const usage = cc.usage
      ? {
          inputTokens: cc.usage.prompt_tokens,
          outputTokens: cc.usage.completion_tokens,
          totalTokens: cc.usage.total_tokens,
          latencyMs: Date.now() - started
        }
      : undefined;
    return { text, provider: 'openai', model, usage };
  }

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
