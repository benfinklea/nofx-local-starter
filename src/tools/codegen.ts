import { routeLLM } from "../models/router";
import { log } from "../lib/logger";

interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: number | string | undefined;
}

export type CodegenResult = { content: string; provider?: string; model?: string; usage?: UsageInfo };

export async function codegenReadme(inputs: { prompt?: string; topic?: string; bullets?: string[]; maxOutputTokens?: number } = {}): Promise<CodegenResult> {
  const hasKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  if (!hasKeys) {
    log.warn("No provider keys set; returning stub content");
    const topic = inputs.topic || "NOFX";
    const bullets = inputs.bullets || ["Control plane", "Verification", "Workers"];
    return { content: `# ${topic}\n\n- ${bullets.join("\n- ")}\n\n_Generated locally without LLM._\n`, provider: 'stub', model: 'stub' };
  }

  // If a direct prompt is provided, use it with clear instructions; otherwise construct README prompt
  let prompt: string;
  if (inputs.prompt) {
    // User provided a custom prompt - pass it through with clear instructions
    // to avoid defaulting to README/documentation format
    prompt = `${inputs.prompt}\n\nIMPORTANT: Respond directly to the request above. Do not format as documentation or README. Just provide the requested content in the appropriate format for the request.`;
  } else {
    // No custom prompt - generate README documentation
    const topic = inputs.topic || "NOFX";
    const bullets = inputs.bullets || ["Control plane", "Verification", "Workers"];
    prompt = `Write a concise README section titled "${topic}" with bullet points: ${bullets.join(", ")}. Keep it tight.`;
  }

  const res = await routeLLM('docs', prompt, { maxOutputTokens: Math.max(1, Number(inputs.maxOutputTokens ?? 800)) });
  if (typeof res === 'string') return { content: res };
  return {
    content: res.text as string,
    provider: res.provider as string | undefined,
    model: res.model as string | undefined,
    usage: res.usage as UsageInfo | undefined
  };
}
