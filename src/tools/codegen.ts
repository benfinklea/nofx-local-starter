import { routeLLM } from "../models/router";
import { log } from "../lib/logger";

export async function codegenReadme(inputs: { topic?: string; bullets?: string[] } = {}): Promise<string> {
  const topic = inputs.topic || "NOFX";
  const bullets = inputs.bullets || ["Control plane", "Verification", "Workers"];
  const hasKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  if (!hasKeys) {
    log.warn("No provider keys set; returning stub content");
    return `# ${topic}\n\n- ${bullets.join("\n- ")}\n\n_Generated locally without LLM._\n`;
  }
  const prompt = `Write a concise README section titled "${topic}" with bullet points: ${bullets.join(", ")}. Keep it tight.`;
  return await routeLLM('docs', prompt);
}
