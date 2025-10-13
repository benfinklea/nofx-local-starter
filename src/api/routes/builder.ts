import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { isAdmin } from '../../lib/auth';
import { BuilderTemplateManager } from '../../services/builder/builderManager';
import type { BuilderTemplateInput, BuilderInputItem } from '../../services/builder/builderTypes';
import { getResponsesRuntime } from '../../services/responses/runtime';

const manager = new BuilderTemplateManager();

const inputItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['input_text', 'input_image', 'input_file', 'input_audio']),
  text: z.string().optional(),
  image_url: z.string().optional(),
  file_id: z.string().optional(),
  audio: z.string().optional(),
  format: z.string().optional(),
});

const channelSchema = z.object({ slack: z.boolean().optional(), email: z.boolean().optional(), inApp: z.boolean().optional() });

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().min(1),
  model: z.string().default('gpt-4.1-mini'),
  input: z.array(inputItemSchema).min(1),
  channels: channelSchema.default({}),
  metadata: z.record(z.string()).optional(),
  tools: z.any().optional(),
  maxToolCalls: z.number().int().positive().optional(),
  toolChoice: z.any().optional(),
  historyPlan: z.any().optional(),
  conversationPolicy: z.any().optional(),
});

const deploySchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  channel: z.enum(['slack', 'email', 'inApp']),
  enabled: z.boolean(),
});

const compileSchema = z.object({
  tenantId: z.string().min(1),
  variables: z.record(z.string(), z.string()),
  metadata: z.record(z.string()).optional(),
});

const runSchema = z.object({
  tenantId: z.string().min(1).default('default'),
  variables: z.record(z.string(), z.string()),
  metadata: z.record(z.string()).optional(),
  background: z.boolean().optional(),
});

function ensureAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'admin required' });
    return false;
  }
  return true;
}

export default function mount(app: Express) {
  app.get('/builder/templates', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const templates = await manager.listTemplates();
      return res.json({ templates });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to list templates' });
    }
  });

  app.post('/builder/templates', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const payload = templateSchema.parse(req.body ?? {});
      const input: BuilderTemplateInput = {
        name: payload.name,
        description: payload.description,
        instructions: payload.instructions,
        model: payload.model,
        input: payload.input.map((part) => ({ ...part } as BuilderInputItem)),
        channels: {
          slack: payload.channels.slack ?? false,
          email: payload.channels.email ?? false,
          inApp: payload.channels.inApp ?? true,
        },
        metadata: payload.metadata,
        tools: payload.tools,
        maxToolCalls: payload.maxToolCalls,
        toolChoice: payload.toolChoice,
        historyPlan: payload.historyPlan,
        conversationPolicy: payload.conversationPolicy,
      };
      const created = await manager.createTemplate(input);
      return res.status(201).json(created);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to create template' });
    }
  });

  app.put('/builder/templates/:id', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const parsed = templateSchema.partial().parse(req.body ?? {});
      const patch: Partial<BuilderTemplateInput> = {};
      if (parsed.name !== undefined) patch.name = parsed.name;
      if (parsed.description !== undefined) patch.description = parsed.description;
      if (parsed.instructions !== undefined) patch.instructions = parsed.instructions;
      if (parsed.model !== undefined) patch.model = parsed.model;
      if (parsed.input !== undefined) {
        patch.input = parsed.input.map((part) => ({ ...part } as BuilderInputItem));
      }
      if (parsed.channels !== undefined) {
        patch.channels = {
          slack: parsed.channels.slack ?? false,
          email: parsed.channels.email ?? false,
          inApp: parsed.channels.inApp ?? true,
        };
      }
      if (parsed.metadata !== undefined) patch.metadata = parsed.metadata;
      if (parsed.tools !== undefined) patch.tools = parsed.tools;
      if (parsed.maxToolCalls !== undefined) patch.maxToolCalls = parsed.maxToolCalls;
      if (parsed.toolChoice !== undefined) patch.toolChoice = parsed.toolChoice;
      if (parsed.historyPlan !== undefined) patch.historyPlan = parsed.historyPlan;
      if (parsed.conversationPolicy !== undefined) patch.conversationPolicy = parsed.conversationPolicy;
      const updated = await manager.updateTemplate(req.params.id, patch);
      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      if (err instanceof Error && err.message === 'template not found') {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to update template' });
    }
  });

  app.post('/builder/templates/:id/deploy', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const payload = deploySchema.parse(req.body ?? {});
      const updated = await manager.updateDeployment(req.params.id, {
        environment: payload.environment,
        channel: payload.channel,
        enabled: payload.enabled,
      });
      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      if (err instanceof Error && err.message === 'template not found') {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to update deployment' });
    }
  });

  app.get('/builder/templates/:id/history', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const history = await manager.getHistory(req.params.id);
      return res.json({ history });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'template not found') {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to fetch history' });
    }
  });

  app.post('/builder/templates/:id/compile', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const payload = compileSchema.parse(req.body ?? {});
      const compiled = await manager.compileTemplate(req.params.id, {
        tenantId: payload.tenantId,
        variables: payload.variables,
        metadata: payload.metadata,
      });
      return res.json(compiled);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      if (err instanceof Error && err.message === 'template not found') {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to compile template' });
    }
  });

  app.post('/builder/templates/:id/run', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const payload = runSchema.parse(req.body ?? {});
      const compiled = await manager.compileTemplate(req.params.id, {
        tenantId: payload.tenantId,
        variables: payload.variables,
        metadata: payload.metadata,
      });

      const runtime = getResponsesRuntime();
      const result = await runtime.service.execute({
        ...compiled,
        metadata: {
          ...(compiled.metadata ?? {}),
          ...(payload.metadata ?? {}),
        },
        background: payload.background ?? false,
      });

      return res.status(201).json({
        runId: result.runId,
        bufferedMessages: result.bufferedMessages,
        reasoning: result.reasoningSummaries,
        refusals: result.refusals,
        historyPlan: result.historyPlan,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      if (err instanceof Error && err.message === 'template not found') {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(500).json({ error: err instanceof Error ? err.message : 'failed to execute template' });
    }
  });
}
