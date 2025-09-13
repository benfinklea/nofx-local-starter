import { GoogleGenerativeAI } from '@google/generative-ai';
export async function geminiChat(prompt: string, model=process.env.GEMINI_MODEL || 'gemini-2.5-pro'){
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelRef = genai.getGenerativeModel({ model });
  const started = Date.now();
  const rsp = await modelRef.generateContent(prompt);
  const text = rsp.response.text().trim();
  const um: any = (rsp.response as any).usageMetadata || {};
  const usage = (um.promptTokenCount || um.candidatesTokenCount) ? {
    inputTokens: um.promptTokenCount,
    outputTokens: um.candidatesTokenCount,
    totalTokens: (um.totalTokenCount) || (um.promptTokenCount || 0) + (um.candidatesTokenCount || 0),
    latencyMs: Date.now() - started
  } : undefined;
  return { text, provider: 'gemini', model, usage };
}
