import { routeLLM } from "../models/router";
import { log } from "../lib/logger";
export type CodegenResult = { content: string; provider?: string; model?: string; usage?: any };

export async function codegenReadme(inputs: { topic?: string; bullets?: string[] } = {}): Promise<CodegenResult> {
  const topic = inputs.topic || "NOFX";
  const bullets = inputs.bullets || ["Control plane", "Verification", "Workers"];
  const hasKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  if (!hasKeys) {
    log.warn("No provider keys set; returning stub content");
    return { content: `# ${topic}\n\n- ${bullets.join("\n- ")}\n\n_Generated locally without LLM._\n`, provider: 'stub', model: 'stub' };
  }
  const prompt = `Write a concise README section titled "${topic}" with bullet points: ${bullets.join(", ")}. Keep it tight.`;
  const res: any = await routeLLM('docs', prompt);
  if (typeof res === 'string') return { content: res };
  return { content: res.text, provider: res.provider, model: res.model, usage: res.usage };
}
