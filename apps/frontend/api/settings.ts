import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSettings, updateSettings } from '../../../src/lib/settings';
import { invalidateNamespace } from '../../../src/lib/cache';
import { listModels, type ModelRow } from '../../../src/lib/models';
import { query } from '../../../src/lib/db';
import { configureAutoBackup } from '../../../src/lib/autobackup';
import { withAuth } from './auth-middleware';

type RuleRow = {
  table_name: string;
  allowed_ops: string[];
  constraints: Record<string, unknown>;
};

async function handler(req: VercelRequest, res: VercelResponse, user: any) {
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
  }

  if (req.method === 'POST') {
    // Update settings
    try {
      const { settings } = req.body;
      if (!settings) {
        return res.status(400).json({ error: 'Settings required' });
      }

      await updateSettings(settings);

      // Configure auto backup if interval changed
      if (settings.ops?.backupIntervalMin) {
        await configureAutoBackup(settings.ops.backupIntervalMin);
      }

      // Clear cache after settings update
      await invalidateNamespace('/');

      return res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update settings';
      return res.status(500).json({ error: message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with auth middleware
export default withAuth(handler);