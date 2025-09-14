import type { Express } from 'express';
import { getSettings, updateSettings } from '../../lib/settings';
import { listModels } from '../../lib/models';
import { query } from '../../lib/db';
import { isAdmin } from '../../lib/auth';

export default function mount(app: Express){
  app.get('/settings', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
    const settings = await getSettings();
    const rules = await query<any>(`select table_name, allowed_ops, constraints from nofx.db_write_rule where tenant_id='local' order by table_name`)
      .catch(()=>({ rows: [] as any[] }));
    let models: any[] = [];
    try { models = await listModels(); } catch { models = []; }
    res.json({ settings, db_write_rules: rules.rows, models });
  });

  app.post('/settings', async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth required', login: '/ui/login' });
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
    res.json({ ok: true, settings: next });
  });
}
