import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSettings, updateSettings } from '../../src/lib/settings';
import { invalidateNamespace } from '../../src/lib/cache';
import { listModels, type ModelRow } from '../../src/lib/models';
import { query } from '../../src/lib/db';
import { isAdmin } from '../../src/lib/auth';
import { configureAutoBackup } from '../../src/lib/autobackup';

type RuleRow = {
  table_name: string;
  allowed_ops: string[];
  constraints: Record<string, unknown>
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check authentication
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }

  if (req.method === 'GET') {
    // Get settings
    try {
      const settings = await getSettings();

      const rules = await query<RuleRow>(
        `select table_name, allowed_ops, constraints from nofx.db_write_rule where tenant_id='local' order by table_name`
      ).catch(() => ({ rows: [] as RuleRow[] }));

      let models: ModelRow[] = [];
      try {
        models = await listModels();
      } catch {
        models = [];
      }

      return res.json({ settings, db_write_rules: rules.rows, models });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to get settings';
      return res.status(500).json({ error: message });
    }
  } else if (req.method === 'POST') {
    // Update settings
    try {
      const body = req.body || {};
      const next = await updateSettings(body.settings || {});

      if (Array.isArray(body.db_write_rules)) {
        // Replace all rules for tenant 'local' with provided set (simple local UX)
        await query(`delete from nofx.db_write_rule where tenant_id='local'`).catch(() => {});

        for (const r of body.db_write_rules) {
          if (!r || !r.table_name || !Array.isArray(r.allowed_ops)) continue;

          await query(
            `insert into nofx.db_write_rule (tenant_id, table_name, allowed_ops, constraints)
             values ('local', $1, $2::text[], $3::jsonb)
             on conflict (tenant_id, table_name) do update set allowed_ops=excluded.allowed_ops, constraints=excluded.constraints`,
            [r.table_name, r.allowed_ops, r.constraints || {}]
          ).catch(() => {});
        }
      }

      // Configure auto backup
      try {
        await configureAutoBackup(next.ops?.backupIntervalMin);
      } catch {}

      // Invalidate LLM caches on settings change (model routing/pricing might change)
      try {
        await invalidateNamespace('llm');
      } catch {}

      return res.json({ ok: true, settings: next });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update settings';
      return res.status(500).json({ error: message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}