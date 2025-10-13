import type { Express } from 'express';
import { getSettings, updateSettings } from '../../lib/settings';
import { invalidateNamespace } from '../../lib/cache';
import { listModels, type ModelRow } from '../../lib/models';
import { query } from '../../lib/db';
import { isAdmin } from '../../lib/auth';
import { configureAutoBackup } from '../../lib/autobackup';

export default function mount(app: Express){
  app.get('/settings', async (req, res): Promise<void> => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: 'auth required', login: '/ui/login' });
      return;
    }
    const settings = await getSettings();
    type RuleRow = { table_name: string; allowed_ops: string[]; constraints: Record<string, unknown> };
    const rules = await query<RuleRow>(`select table_name, allowed_ops, constraints from nofx.db_write_rule where tenant_id='local' order by table_name`)
      .catch(()=>({ rows: [] as RuleRow[] }));
    let models: ModelRow[] = [];
    try { models = await listModels(); } catch { models = []; }
    res.json({ settings, db_write_rules: rules.rows, models });
  });

  app.post('/settings', async (req, res): Promise<void> => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: 'auth required', login: '/ui/login' });
      return;
    }
    const body = req.body || {};
    const next = await updateSettings(body.settings || {});
    if (Array.isArray(body.db_write_rules)) {
      // replace all rules for tenant 'local' with provided set (simple local UX)
      await query(`delete from nofx.db_write_rule where tenant_id='local'`).catch(()=>{});
      for (const r of body.db_write_rules) {
        if (!r || !r.table_name || !Array.isArray(r.allowed_ops)) continue;
        await query(
          `insert into nofx.db_write_rule (tenant_id, table_name, allowed_ops, constraints)
           values ('local', $1, $2::text[], $3::jsonb)
           on conflict (tenant_id, table_name) do update set allowed_ops=excluded.allowed_ops, constraints=excluded.constraints`,
          [r.table_name, r.allowed_ops, r.constraints || {}]
        ).catch(()=>{});
      }
    }
    try { await configureAutoBackup(next.ops?.backupIntervalMin); } catch {}
    // Invalidate LLM caches on settings change (model routing/pricing might change)
    try { await invalidateNamespace('llm'); } catch {}
    res.json({ ok: true, settings: next });
  });
}
