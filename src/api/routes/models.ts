import type { Express } from 'express';
import { isAdmin } from '../../lib/auth';
import { listModels, upsertModel, deleteModel } from '../../lib/models';
import { importOpenAIModels, seedAnthropicModels, seedGeminiModels } from '../../lib/modelImporters';
import { getModelByName, upsertModel } from '../../lib/models';
import { getSettings, updateSettings } from '../../lib/settings';

export default function mount(app: Express){
  app.get('/models', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const rows = await listModels();
    res.json({ models: rows });
  });
  app.post('/models', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    try {
      const m = await upsertModel(req.body || {});
      res.status(201).json(m);
    } catch (e:any) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post('/models/import/:vendor', async (req, res) => {
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
    } catch (e:any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/models/promote/gemini', async (req, res) => {
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
      } as any);
      const settings = await getSettings();
      const mo = settings.llm.modelOrder || {} as any;
      function repl(arr?: string[]){
        return Array.isArray(arr) ? arr.map(x => x === from ? to : x) : [];
      }
      const next = {
        llm: {
          modelOrder: {
            docs: repl(mo.docs),
            reasoning: repl(mo.reasoning),
            codegen: repl(mo.codegen)
          }
        }
      } as any;
      await updateSettings(next);
      res.json({ ok: true, updatedModel: to });
    } catch (e:any) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete('/models/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    await deleteModel(req.params.id);
    res.json({ ok: true });
  });
}
