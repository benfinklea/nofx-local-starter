import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { isAllowed, DbOp } from "../../policy/dbWritePolicy";
import { getSettings } from "../../lib/settings";
import { enqueue, STEP_READY_TOPIC } from "../../lib/queue";

type Inputs = {
  table: string;
  op: DbOp;
  values?: Record<string, any>;
  where?: string;          // SQL where clause with $1,$2 params
  whereParams?: any[];     // parameter values for where
};

function isSafeIdent(v: string){
  return /^[a-zA-Z0-9_.]+$/.test(v);
}
function isSafeColumn(v: string){
  return /^[a-zA-Z0-9_]+$/.test(v);
}

const handler: StepHandler = {
  match: (tool) => tool === 'db_write',
  async run({ runId, step }) {
    const stepId = step.id;
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId])
      .catch(async ()=>{ await query(`update nofx.step set status='running' where id=$1`, [stepId]); });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    const inputs: Inputs = step.inputs as Inputs || { table: '', op: 'select' };
    if (!inputs.table || !inputs.op) throw new Error('db_write requires table and op');
    if (!isSafeIdent(inputs.table)) throw new Error('unsafe table name');

    // Check approval policy for db writes
    const { approvals } = await getSettings();
    let needsApproval = false;
    if (approvals.dbWrites === 'all') needsApproval = true;
    if (approvals.dbWrites === 'dangerous' && (inputs.op === 'update' || inputs.op === 'delete')) needsApproval = true;

    if (needsApproval) {
      const g = await query<any>(`select * from nofx.gate where run_id=$1 and step_id=$2 and gate_type='manual:db' order by created_at desc limit 1`, [runId, stepId]);
      if (!g.rows[0]) {
        await query(`insert into nofx.gate (run_id, step_id, gate_type, status) values ($1,$2,'manual:db','pending')`, [runId, stepId]);
        await recordEvent(runId, 'gate.created', { stepId, tool: 'manual:db' }, stepId);
        await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: 5000 });
        await recordEvent(runId, 'gate.waiting', { stepId, delayMs: 5000 }, stepId);
        return;
      }
      const gate = g.rows[0];
      if (gate.status === 'pending') {
        await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: 5000 });
        await recordEvent(runId, 'gate.waiting', { stepId, delayMs: 5000 }, stepId);
        return;
      }
      if (gate.status === 'failed') {
        await query(`update nofx.step set status='failed', ended_at=now(), error=$2 where id=$1`, [stepId, 'db write not approved'])
          .catch(async ()=>{ await query(`update nofx.step set status='failed', completed_at=now(), error=$2 where id=$1`, [stepId, 'db write not approved']); });
        await recordEvent(runId, 'step.failed', { stepId, tool: step.tool, manual: true, gateId: gate.id }, stepId);
        throw new Error('db write not approved');
      }
      // passed or waived -> continue
    }

    const allowed = await isAllowed(inputs.table, inputs.op);
    if (!allowed.ok) {
      await query(`update nofx.step set status='failed', ended_at=now(), error=$2 where id=$1`, [stepId, `policy: ${allowed.reason}`])
        .catch(async ()=>{ await query(`update nofx.step set status='failed', completed_at=now(), error=$2 where id=$1`, [stepId, `policy: ${allowed.reason}`]); });
      await recordEvent(runId, 'db.write.denied', { table: inputs.table, op: inputs.op, reason: allowed.reason }, stepId);
      throw new Error('db_write not allowed');
    }

    let sql = '';
    const params: any[] = [];
    let result: any = {};
    if (inputs.op === 'insert') {
      const vals = inputs.values || {};
      const cols = Object.keys(vals);
      if (cols.length === 0) throw new Error('insert requires values');
      for (const c of cols) if (!isSafeColumn(c)) throw new Error('unsafe column');
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      params.push(...cols.map(c => vals[c]));
      sql = `insert into ${inputs.table} (${cols.join(',')}) values (${placeholders.join(',')}) returning *`;
    } else if (inputs.op === 'update') {
      const vals = inputs.values || {};
      const cols = Object.keys(vals);
      if (cols.length === 0) throw new Error('update requires values');
      if (!inputs.where) throw new Error('update requires where');
      for (const c of cols) if (!isSafeColumn(c)) throw new Error('unsafe column');
      const sets = cols.map((c, i) => `${c} = $${i + 1}`);
      params.push(...cols.map(c => vals[c]));
      const remappedWhere = remapPlaceholders(inputs.where!, params.length);
      params.push(...(inputs.whereParams || []));
      sql = `update ${inputs.table} set ${sets.join(', ')} where ${remappedWhere} returning *`;
    } else if (inputs.op === 'delete') {
      if (!inputs.where) throw new Error('delete requires where');
      const remappedWhere = remapPlaceholders(inputs.where!, params.length);
      params.push(...(inputs.whereParams || []));
      sql = `delete from ${inputs.table} where ${remappedWhere} returning *`;
    } else {
      throw new Error('unknown op');
    }

    const q = await query<any>(sql, params);
    result = { rowCount: (q as any).rows?.length ?? 0, rows: (q as any).rows ?? [] };

    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      stepId,
      JSON.stringify({ table: inputs.table, op: inputs.op, result })
    ]).catch(async ()=>{
      await query(`update nofx.step set status='succeeded', outputs=$2, completed_at=now() where id=$1`, [
        stepId,
        JSON.stringify({ table: inputs.table, op: inputs.op, result })
      ]);
    });
    await recordEvent(runId, 'db.write.succeeded', { table: inputs.table, op: inputs.op, rowCount: result.rowCount }, stepId);
  }
};

export default handler;

// Remap $1..$N in a WHERE clause to start at current parameter offset.
function remapPlaceholders(where: string, currentParams: number): string {
  return where.replace(/\$(\d+)/g, (_m, g1) => {
    const n = parseInt(g1, 10);
    if (!Number.isFinite(n) || n <= 0) return _m;
    return `$${currentParams + n}`;
  });
}
