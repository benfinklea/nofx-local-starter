import type { Express } from 'express';
import { isAdmin } from '../../lib/auth';
import { listModels, upsertModel, deleteModel, getModelByName } from '../../lib/models';
import { importOpenAIModels, seedAnthropicModels, seedGeminiModels, listOpenAIModels } from '../../lib/modelImporters';
import { getSettings, updateSettings } from '../../lib/settings';

export default function mount(app: Express){
  app.get('/models', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const rows = await listModels();
    return res.json({ models: rows });
  });
  app.post('/models', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    try {
      const m = await upsertModel(req.body || {});
      return res.status(201).json(m);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(400).json({ error: msg });
    }
  });
  app.post('/models/preview/openai', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    try {
      const filterRaw = (req.body && (req.body.filter || req.body.includes)) || '';
      const excludeRaw = (req.body && (req.body.exclude || req.body.excludes)) || '';
      const filter = Array.isArray(filterRaw) ? filterRaw : String(filterRaw).split(',').map((s:string)=>s.trim()).filter(Boolean);
      const exclude = Array.isArray(excludeRaw) ? excludeRaw : String(excludeRaw).split(',').map((s:string)=>s.trim()).filter(Boolean);
      const recommendedOnly = filter.length === 0 ? !!(req.body && (req.body.recommendedOnly ?? true)) : false;
      const candidates = await listOpenAIModels({ filter, exclude, recommendedOnly });
      return res.json({ candidates, count: candidates.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(400).json({ error: msg });
    }
  });
  app.post('/models/import/:vendor', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const v = (req.params.vendor || '').toLowerCase();
    try {
      const namesRaw = req.body && (req.body.names || req.body.list);
      const names = Array.isArray(namesRaw)
        ? namesRaw
        : (typeof namesRaw === 'string' ? namesRaw.split(',').map((s:string)=>s.trim()).filter(Boolean) : []);
      if (names.length && (v === 'anthropic' || v === 'gemini')) {
        let count = 0;
        for (const n of names) {
          await upsertModel({ provider: v, name: n, kind: v, display_name: n });
          count++;
        }
        return res.json({ imported: count, via: 'custom-list' });
      }
      if (v === 'openai') {
        // If explicit names are provided, upsert just those.
        if (names.length) {
          let count = 0;
          for (const n of names) {
            await upsertModel({ provider: 'openai', name: n, kind: 'openai', display_name: n });
            count++;
          }
          return res.json({ imported: count, via: 'explicit-list' });
        }
        const filterRaw = (req.body && (req.body.filter || req.body.includes)) || '';
        const excludeRaw = (req.body && (req.body.exclude || req.body.excludes)) || '';
        const filter = Array.isArray(filterRaw) ? filterRaw : String(filterRaw).split(',').map((s:string)=>s.trim()).filter(Boolean);
        const exclude = Array.isArray(excludeRaw) ? excludeRaw : String(excludeRaw).split(',').map((s:string)=>s.trim()).filter(Boolean);
        // If user provided filters, don't restrict to recommended only.
        const recommendedOnly = filter.length === 0 ? !!(req.body && (req.body.recommendedOnly ?? true)) : false;
        const r = await importOpenAIModels({ filter, exclude, recommendedOnly });
        return res.json(r);
      }
      if (v === 'anthropic') return res.json(await seedAnthropicModels());
      if (v === 'gemini') return res.json(await seedGeminiModels());
      return res.status(400).json({ error: 'unknown vendor' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/models/promote/gemini', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    try {
      const from = 'gemini-1.5-pro';
      const to = 'gemini-2.5-pro';
      const fromModel = await getModelByName(from);
      await upsertModel({
        provider: 'gemini',
        name: to,
        kind: 'gemini',
        display_name: 'Gemini 2.5 Pro',
        input_per_1m: fromModel?.input_per_1m,
        output_per_1m: fromModel?.output_per_1m,
        active: true
      });
      const settings = await getSettings();
      const mo = (settings.llm?.modelOrder ?? {}) as Record<string, string[]>;
      const repl = (arr?: string[]) => Array.isArray(arr) ? arr.map(x => x === from ? to : x) : [];
      const next = {
        llm: {
          // preserve required `order` to satisfy type and semantics
          order: settings.llm.order,
          modelOrder: {
            docs: repl(mo.docs),
            reasoning: repl(mo.reasoning),
            codegen: repl(mo.codegen)
          }
        }
      } as const;
      await updateSettings(next);
      return res.json({ ok: true, updatedModel: to });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(400).json({ error: msg });
    }
  });
  app.delete('/models/:id', async (req, res): Promise<void> => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    await deleteModel(req.params.id);
    return res.json({ ok: true });
  });
}
