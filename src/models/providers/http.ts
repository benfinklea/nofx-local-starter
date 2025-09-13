export async function httpChat(prompt: string, endpoint: string, apiKeyEnv?: string, model?: string){
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  const keyName = apiKeyEnv || '';
  const keyVal = keyName ? process.env[keyName] : undefined;
  if (keyVal) headers['Authorization'] = `Bearer ${keyVal}`;
  const rsp = await fetch(endpoint, { method:'POST', headers, body: JSON.stringify({ prompt, model }) });
  if (!rsp.ok) throw new Error(`http provider ${endpoint} status ${rsp.status}`);
  const data = await rsp.json();
  const text = data.text || data.output || '';
  const usage = data.usage || undefined;
  return { text, provider: endpoint, model, usage };
}

