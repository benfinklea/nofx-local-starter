import { query } from './db';

export type ModelRow = {
  id: string;
  tenant_id: string;
  name: string;
  display_name?: string;
  provider: string;
  kind: string;
  base_url?: string;
  input_per_1m?: number;
  output_per_1m?: number;
  context_tokens?: number;
  max_output_tokens?: number;
  active: boolean;
  metadata?: any;
};

export async function listModels(): Promise<ModelRow[]> {
  const r = await query<ModelRow>(`select * from nofx.model where tenant_id='local' order by provider, name`);
  return r.rows as any;
}
export async function getModelByName(name: string): Promise<ModelRow | undefined> {
  const r = await query<ModelRow>(`select * from nofx.model where tenant_id='local' and name=$1 limit 1`, [name]);
  return r.rows[0] as any;
}
export async function upsertModel(m: Partial<ModelRow>): Promise<ModelRow> {
  const r = await query<ModelRow>(
    `insert into nofx.model (tenant_id, name, display_name, provider, kind, base_url, input_per_1m, output_per_1m, context_tokens, max_output_tokens, active, metadata)
     values ('local', $1,$2,$3,$4,$5,$6,$7,$8,$9, coalesce($10,true), coalesce($11,'{}'::jsonb))
     on conflict (tenant_id, provider, name) do update set display_name=excluded.display_name, kind=excluded.kind, base_url=excluded.base_url, input_per_1m=excluded.input_per_1m, output_per_1m=excluded.output_per_1m, context_tokens=excluded.context_tokens, max_output_tokens=excluded.max_output_tokens, active=excluded.active, metadata=excluded.metadata
     returning *`,
    [m.name, m.display_name || null, m.provider, m.kind || 'openai', m.base_url || null, m.input_per_1m || null, m.output_per_1m || null, m.context_tokens || null, m.max_output_tokens || null, m.active ?? true, m.metadata || {}]
  );
  return r.rows[0] as any;
}
export async function deleteModel(id: string): Promise<void> {
  await query(`delete from nofx.model where id=$1 and tenant_id='local'`, [id]);
}

