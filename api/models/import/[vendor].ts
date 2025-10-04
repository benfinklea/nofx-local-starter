import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../../src/lib/auth';
import { upsertModel } from '../../../src/lib/models';
import { withCors } from '../../_lib/cors';

// Model definitions for each vendor
const VENDOR_MODELS: Record<string, Array<{
  name: string;
  display_name: string;
  provider: string;
  kind: string;
  context_tokens?: number;
  max_output_tokens?: number;
  input_per_1m?: number;
  output_per_1m?: number;
}>> = {
  openai: [
    { name: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai', kind: 'openai', context_tokens: 128000, max_output_tokens: 16384, input_per_1m: 2.50, output_per_1m: 10.00 },
    { name: 'gpt-4o-mini', display_name: 'GPT-4o Mini', provider: 'openai', kind: 'openai', context_tokens: 128000, max_output_tokens: 16384, input_per_1m: 0.15, output_per_1m: 0.60 },
    { name: 'gpt-4-turbo', display_name: 'GPT-4 Turbo', provider: 'openai', kind: 'openai', context_tokens: 128000, max_output_tokens: 4096, input_per_1m: 10.00, output_per_1m: 30.00 },
    { name: 'gpt-4', display_name: 'GPT-4', provider: 'openai', kind: 'openai', context_tokens: 8192, max_output_tokens: 8192, input_per_1m: 30.00, output_per_1m: 60.00 },
    { name: 'gpt-3.5-turbo', display_name: 'GPT-3.5 Turbo', provider: 'openai', kind: 'openai', context_tokens: 16385, max_output_tokens: 4096, input_per_1m: 0.50, output_per_1m: 1.50 },
  ],
  anthropic: [
    { name: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet', provider: 'anthropic', kind: 'anthropic', context_tokens: 200000, max_output_tokens: 8192, input_per_1m: 3.00, output_per_1m: 15.00 },
    { name: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku', provider: 'anthropic', kind: 'anthropic', context_tokens: 200000, max_output_tokens: 8192, input_per_1m: 0.80, output_per_1m: 4.00 },
    { name: 'claude-3-opus-20240229', display_name: 'Claude 3 Opus', provider: 'anthropic', kind: 'anthropic', context_tokens: 200000, max_output_tokens: 4096, input_per_1m: 15.00, output_per_1m: 75.00 },
    { name: 'claude-3-sonnet-20240229', display_name: 'Claude 3 Sonnet', provider: 'anthropic', kind: 'anthropic', context_tokens: 200000, max_output_tokens: 4096, input_per_1m: 3.00, output_per_1m: 15.00 },
    { name: 'claude-3-haiku-20240307', display_name: 'Claude 3 Haiku', provider: 'anthropic', kind: 'anthropic', context_tokens: 200000, max_output_tokens: 4096, input_per_1m: 0.25, output_per_1m: 1.25 },
  ],
  gemini: [
    { name: 'gemini-2.0-flash-exp', display_name: 'Gemini 2.0 Flash', provider: 'gemini', kind: 'gemini', context_tokens: 1000000, max_output_tokens: 8192, input_per_1m: 0.00, output_per_1m: 0.00 },
    { name: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', provider: 'gemini', kind: 'gemini', context_tokens: 2000000, max_output_tokens: 8192, input_per_1m: 1.25, output_per_1m: 5.00 },
    { name: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', provider: 'gemini', kind: 'gemini', context_tokens: 1000000, max_output_tokens: 8192, input_per_1m: 0.075, output_per_1m: 0.30 },
  ],
};

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vendor } = req.query;

  if (typeof vendor !== 'string') {
    return res.status(400).json({ error: 'Invalid vendor parameter' });
  }

  const models = VENDOR_MODELS[vendor.toLowerCase()];

  if (!models) {
    return res.status(400).json({ error: `Unknown vendor: ${vendor}. Supported vendors: openai, anthropic, gemini` });
  }

  try {
    const imported = [];
    for (const model of models) {
      const result = await upsertModel(model);
      imported.push(result);
    }

    return res.status(200).json({
      success: true,
      vendor,
      imported: imported.length,
      models: imported
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to import models';
    return res.status(500).json({ error: message });
  }
});
