import { GoogleGenerativeAI } from '@google/generative-ai';
export async function geminiChat(prompt: string, model=process.env.GEMINI_MODEL || 'gemini-1.5-pro'){
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelRef = genai.getGenerativeModel({ model });
  const rsp = await modelRef.generateContent(prompt);
  return rsp.response.text().trim();
}