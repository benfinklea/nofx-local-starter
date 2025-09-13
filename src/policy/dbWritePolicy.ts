import { query } from "../lib/db";
export type DbOp = 'insert'|'update'|'delete';
export async function isAllowed(table: string, op: DbOp){
  const r = await query<any>(`select allowed_ops, constraints from nofx.db_write_rule where tenant_id='local' and table_name=$1`, [table]);
  if (!r.rows[0]) return { ok:false, reason:'no rule' };
  const ops: string[] = r.rows[0].allowed_ops || [];
  if (!ops.includes(op)) return { ok:false, reason:'op not allowed' };
  return { ok:true, constraints: r.rows[0].constraints || {} };
}