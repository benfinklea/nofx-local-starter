# 60_DB_WRITE — Whitelist + Enforcement

**Depends on:** 00_BASE

## Files to add
- `supabase/migrations/0003_db_write_policy.sql`
- `src/policy/dbWritePolicy.ts`
- `src/worker/handlers/db_write.ts`

### 1) Migration
`supabase/migrations/0003_db_write_policy.sql`
```sql
create table if not exists nofx.db_write_rule (
  id uuid primary key default uuid_generate_v4(),
  tenant_id text not null default 'local',
  table_name text not null,
  allowed_ops text[] not null,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists db_write_rule_unique on nofx.db_write_rule(tenant_id, table_name);
```

### 2) Policy service
`src/policy/dbWritePolicy.ts`
```ts
import { query } from "../lib/db";
export type DbOp = 'insert'|'update'|'delete';
export async function isAllowed(table: string, op: DbOp){
  const r = await query<any>(`select allowed_ops, constraints from nofx.db_write_rule where tenant_id='local' and table_name=$1`, [table]);
  if (!r.rows[0]) return { ok:false, reason:'no rule' };
  const ops: string[] = r.rows[0].allowed_ops || [];
  if (!ops.includes(op)) return { ok:false, reason:'op not allowed' };
  return { ok:true, constraints: r.rows[0].constraints || {} };
}
```

### 3) Handler
`src/worker/handlers/db_write.ts`
```ts
import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { isAllowed } from "../../policy/dbWritePolicy";

const handler: StepHandler = {
  match: (tool) => tool === 'db_write',
  async run({ runId, step }) {
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [step.id]);
    const p = step.inputs || {};
    const table = String(p.table);
    const op = String(p.op) as 'insert'|'update'|'delete';
    const chk = await isAllowed(table, op);
    if (!chk.ok) throw new Error(`db_write denied: ${chk.reason}`);

    let result: any;
    if (op === 'insert') {
      const cols = Object.keys(p.values[0] || {});
      const rows = (p.values as any[]).map((v:any) => cols.map(c => v[c]));
      const placeholders = rows.map((row:any, i:number) => `(${row.map((_:any,j:number)=>'$'+(i*cols.length+j+1)).join(',')})`).join(',');
      const flat = rows.flat();
      const sql = `insert into ${table} (${cols.join(',')}) values ${placeholders} returning *`;
      result = await query<any>(sql, flat);
    } else if (op === 'update') {
      const set = p.set || {};
      const keys = Object.keys(set);
      const vals = Object.values(set);
      const sql = `update ${table} set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where ${p.where || 'false'} returning *`;
      result = await query<any>(sql, vals);
    } else if (op === 'delete') {
      const sql = `delete from ${table} where ${p.where || 'false'} returning *`;
      result = await query<any>(sql, []);
    } else {
      throw new Error('unsupported op');
    }

    const path = `runs/${runId}/steps/${step.id}/db_write_result.json`;
    await supabase.storage.from(ARTIFACT_BUCKET).upload(path, new Blob([JSON.stringify(result.rows,null,2)]), { upsert: true } as any);
    await query(`insert into nofx.artifact (step_id, type, uri, metadata) values ($1,$2,$3,$4)`, [
      step.id, "application/json", path, JSON.stringify({ table, op })
    ]);
    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      step.id, JSON.stringify({ count: result.rows.length })
    ]);
    await recordEvent(runId, 'db.write', { table, op, count: result.rows.length }, step.id);
  }
};
export default handler;
```

## Done
Commit: `feat(db): whitelist table + db_write handler`
