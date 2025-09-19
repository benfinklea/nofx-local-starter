import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { query as pgQuery } from './db';

type RunRow = { id: string; status: string; plan?: any; created_at: string; ended_at?: string };
type StepRow = { id: string; run_id: string; name: string; tool: string; inputs?: any; outputs?: any; status: string; created_at: string; started_at?: string; ended_at?: string; idempotency_key?: string };
type EventRow = { id: string; run_id: string; step_id?: string; type: string; payload: any; created_at: string };
type GateRow = { id: string; run_id: string; step_id: string; gate_type: string; status: string; created_at: string; approved_by?: string; approved_at?: string };
type ArtifactRow = { id: string; step_id: string; type: string; path: string; metadata?: any; created_at: string };

function dataDriver() { return (process.env.DATA_DRIVER || (process.env.QUEUE_DRIVER === 'memory' ? 'fs' : 'db')).toLowerCase(); }
const ROOT = path.join(process.cwd(), 'local_data');
const FS_INBOX_KEYS = new Set<string>();

function ensureDirSync(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

// ---------- FS DRIVER ----------
async function fsCreateRun(plan: any): Promise<RunRow> {
  ensureDirSync(ROOT);
  const id = randomUUID();
  const created_at = new Date().toISOString();
  const run: RunRow = { id, status: 'queued', plan, created_at };
  const dir = path.join(ROOT, 'runs', id);
  ensureDirSync(dir);
  await fsp.writeFile(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  // index
  const idxDir = path.join(ROOT, 'runs'); ensureDirSync(idxDir);
  await fsp.writeFile(path.join(idxDir, 'index.json'), JSON.stringify(await fsListRuns(100), null, 2)).catch(()=>{});
  return run;
}
async function fsGetRun(id: string): Promise<RunRow | undefined> {
  try { const s = await fsp.readFile(path.join(ROOT, 'runs', id, 'run.json'), 'utf8'); return JSON.parse(s); } catch { return undefined; }
}
async function fsUpdateRun(id: string, patch: Partial<RunRow>): Promise<void> {
  const run = await fsGetRun(id); if (!run) return;
  Object.assign(run, patch); await fsp.writeFile(path.join(ROOT, 'runs', id, 'run.json'), JSON.stringify(run, null, 2));
}
async function fsListRuns(limit = 100): Promise<Array<Pick<RunRow,'id'|'status'|'created_at'> & { title?: string }>> {
  const dir = path.join(ROOT, 'runs'); ensureDirSync(dir);
  const ids = (await fsp.readdir(dir)).filter(d => d !== 'index.json');
  const rows: Array<Pick<RunRow,'id'|'status'|'created_at'> & { title?: string }> = [];
  for (const id of ids) {
    try {
      const s = await fsp.readFile(path.join(dir, id, 'run.json'), 'utf8');
      const r = JSON.parse(s);
      const title = (r.plan && r.plan.goal) ? String(r.plan.goal) : '';
      rows.push({ id: r.id, status: r.status, created_at: r.created_at, title });
    } catch {}
  }
  rows.sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, limit);
}
async function fsCreateStep(runId: string, name: string, tool: string, inputs?: any, idempotencyKey?: string): Promise<StepRow> {
  const id = randomUUID();
  const created_at = new Date().toISOString();
  // If an idempotency key is provided, check existing steps for a match and return it
  if (idempotencyKey) {
    const existing = await fsFindStepByIdempotencyKey(runId, idempotencyKey);
    if (existing) return existing;
  }
  const step: StepRow = { id, run_id: runId, name, tool, inputs: inputs || {}, status: 'queued', created_at, idempotency_key: idempotencyKey } as any;
  const dir = path.join(ROOT, 'runs', runId, 'steps'); ensureDirSync(dir);
  await fsp.writeFile(path.join(dir, `${id}.json`), JSON.stringify(step, null, 2));
  return step;
}
async function fsGetStep(id: string): Promise<StepRow | undefined> {
  // Search all runs' steps; optimize by tracking index later
  const runsDir = path.join(ROOT, 'runs'); ensureDirSync(runsDir);
  for (const runId of await fsp.readdir(runsDir)) {
    if (runId === 'index.json') continue;
    const p = path.join(runsDir, runId, 'steps', `${id}.json`);
    try { const s = await fsp.readFile(p, 'utf8'); return JSON.parse(s); } catch {}
  }
  return undefined;
}
async function fsFindStepByIdempotencyKey(runId: string, key: string): Promise<StepRow | undefined> {
  const dir = path.join(ROOT, 'runs', runId, 'steps'); ensureDirSync(dir);
  const files = await fsp.readdir(dir).catch(()=>[] as string[]);
  for (const f of files) {
    try {
      const s = await fsp.readFile(path.join(dir, f), 'utf8');
      const st = JSON.parse(s) as StepRow;
      if ((st as any).idempotency_key === key) return st;
    } catch {}
  }
  return undefined;
}
async function fsUpdateStep(id: string, patch: Partial<StepRow>): Promise<void> {
  const runsDir = path.join(ROOT, 'runs'); ensureDirSync(runsDir);
  for (const runId of await fsp.readdir(runsDir)) {
    if (runId === 'index.json') continue;
    const p = path.join(runsDir, runId, 'steps', `${id}.json`);
    try { const s = await fsp.readFile(p, 'utf8'); const step = JSON.parse(s); Object.assign(step, patch); await fsp.writeFile(p, JSON.stringify(step, null, 2)); return; } catch {}
  }
}
async function fsListStepsByRun(runId: string): Promise<StepRow[]> {
  const dir = path.join(ROOT, 'runs', runId, 'steps'); ensureDirSync(dir);
  const files = await fsp.readdir(dir).catch(()=>[] as string[]);
  const rows: StepRow[] = [];
  for (const f of files) {
    try { const s = await fsp.readFile(path.join(dir, f), 'utf8'); rows.push(JSON.parse(s)); } catch {}
  }
  rows.sort((a,b)=> (a.created_at < b.created_at ? -1 : 1));
  return rows;
}
async function fsCountRemainingSteps(runId: string): Promise<number> {
  const steps = await fsListStepsByRun(runId);
  return steps.filter(s => !['succeeded','cancelled'].includes(s.status)).length;
}
async function fsRecordEvent(runId: string, type: string, payload: any = {}, stepId?: string): Promise<void> {
  const dir = path.join(ROOT, 'runs', runId); ensureDirSync(dir);
  const file = path.join(dir, 'events.json');
  const rows: EventRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  rows.push({ id: randomUUID(), run_id: runId, step_id: stepId, type, payload, created_at: new Date().toISOString() });
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
}
async function fsListEvents(runId: string): Promise<EventRow[]> {
  const file = path.join(ROOT, 'runs', runId, 'events.json');
  const rows: EventRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  rows.sort((a,b)=> (a.created_at < b.created_at ? -1 : 1));
  return rows;
}
async function fsCreateOrGetGate(runId: string, stepId: string, gate_type: string): Promise<GateRow> {
  const file = path.join(ROOT, 'runs', runId, 'gates.json');
  const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  let g = rows.filter(r => r.step_id === stepId && r.gate_type === gate_type).sort((a,b)=> (a.created_at < b.created_at ? 1 : -1))[0];
  if (!g) {
    g = { id: randomUUID(), run_id: runId, step_id: stepId, gate_type, status: 'pending', created_at: new Date().toISOString() };
    rows.push(g);
    await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  }
  return g;
}
async function fsUpdateGate(id: string, patch: Partial<GateRow>): Promise<void> {
  const file = path.join(ROOT, 'runs', (patch as any).run_id || '', 'gates.json');
  const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  const i = rows.findIndex(r => r.id === id);
  if (i >= 0) {
    const next = { ...rows[i], ...patch } as GateRow;
    if (patch.approved_by && !patch.approved_at) next.approved_at = new Date().toISOString();
    rows[i] = next;
    await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  }
}
async function fsGetLatestGate(runId: string, stepId: string): Promise<GateRow | undefined> {
  const file = path.join(ROOT, 'runs', runId, 'gates.json');
  const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  return rows.filter(r => r.step_id === stepId).sort((a,b)=> (a.created_at < b.created_at ? 1 : -1))[0];
}
async function fsListGatesByRun(runId: string): Promise<GateRow[]> {
  const file = path.join(ROOT, 'runs', runId, 'gates.json');
  const rows: GateRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  rows.sort((a,b)=> (a.created_at < b.created_at ? -1 : 1));
  return rows;
}
async function fsAddArtifact(stepId: string, type: string, pth: string, metadata?: any): Promise<ArtifactRow> {
  const step = await fsGetStep(stepId); if (!step) throw new Error('step not found');
  const file = path.join(ROOT, 'runs', step.run_id, 'artifacts.json');
  const rows: ArtifactRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  const row: ArtifactRow = { id: randomUUID(), step_id: stepId, type, path: pth, metadata: metadata || {}, created_at: new Date().toISOString() };
  rows.push(row);
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  return row;
}
async function fsListArtifactsByRun(runId: string): Promise<Array<ArtifactRow & { step_name?: string }>> {
  const file = path.join(ROOT, 'runs', runId, 'artifacts.json');
  const rows: ArtifactRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  const steps = await fsListStepsByRun(runId);
  const names = new Map(steps.map(s => [s.id, s.name] as const));
  return rows.map(r => ({ ...r, step_name: names.get(r.step_id) }));
}

// ---------- Inbox/Outbox (FS minimal impl) ----------
async function fsInboxMarkIfNew(key: string): Promise<boolean> {
  if (FS_INBOX_KEYS.has(key)) return false;
  FS_INBOX_KEYS.add(key);
  return true;
}
type OutboxRow = { id: string; topic: string; payload: any; sent: boolean; created_at: string };
async function fsOutboxAdd(topic: string, payload: any): Promise<void> {
  const file = path.join(ROOT, 'outbox.json');
  const rows: OutboxRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  rows.push({ id: randomUUID(), topic, payload, sent: false, created_at: new Date().toISOString() });
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
}
async function fsOutboxListUnsent(limit = 50): Promise<OutboxRow[]> {
  const file = path.join(ROOT, 'outbox.json');
  const rows: OutboxRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  return rows.filter(r => !r.sent).slice(0, limit);
}
async function fsOutboxMarkSent(id: string): Promise<void> {
  const file = path.join(ROOT, 'outbox.json');
  const rows: OutboxRow[] = JSON.parse(await fsp.readFile(file, 'utf8').catch(()=> '[]'));
  const idx = rows.findIndex(r => r.id === id);
  if (idx >= 0) { rows[idx].sent = true; await fsp.writeFile(file, JSON.stringify(rows, null, 2)); }
}

// ---------- PUBLIC API ----------
export const store = {
  get driver() { return dataDriver(); },
  // runs
  createRun: async (plan:any, projectId: string = 'default') => dataDriver() === 'db'
    ? (await pgQuery<{ id:string }>(`insert into nofx.run (plan, status, project_id) values ($1, 'queued', $2) returning id`, [plan, projectId])).rows[0] as any
    : fsCreateRun(plan),
  getRun: async (id:string) => dataDriver() === 'db'
    ? (await pgQuery<RunRow>(`select * from nofx.run where id = $1`, [id])).rows[0]
    : fsGetRun(id),
  updateRun: async (id:string, patch: Partial<RunRow>) => {
    if (dataDriver() !== 'db') return fsUpdateRun(id, patch);
    // Try ended_at first; if column missing, fall back to completed_at
    try {
      await pgQuery(`update nofx.run set status=coalesce($2,status), ended_at=coalesce($3,ended_at) where id=$1`, [id, (patch as any).status, (patch as any).ended_at]);
    } catch (e) {
      // Fallback to completed_at if ended_at column doesn't exist
      await pgQuery(`update nofx.run set status=coalesce($2,status), completed_at=coalesce($3,completed_at) where id=$1`, [id, (patch as any).status, (patch as any).ended_at || (patch as any).completed_at]);
    }
  },
  listRuns: async (limit=100, projectId?: string) => {
    if (dataDriver() !== 'db') return fsListRuns(limit);
    if (projectId) {
      return (await pgQuery<any>(`select id,status,created_at, coalesce(plan->>'goal','') as title from nofx.run where project_id = $1 order by created_at desc limit ${limit}`, [projectId])).rows;
    }
    return (await pgQuery<any>(`select id,status,created_at, coalesce(plan->>'goal','') as title from nofx.run order by created_at desc limit ${limit}`)).rows;
  },
  // steps
  createStep: async (runId:string, name:string, tool:string, inputs?:any, idempotencyKey?: string) => dataDriver() === 'db'
    ? (await pgQuery<{ id:string }>(
        `insert into nofx.step (run_id, name, tool, inputs, status, idempotency_key)
         values ($1,$2,$3,$4,'queued',$5)
         on conflict (idempotency_key) do nothing
         returning id`, [runId, name, tool, inputs || {}, idempotencyKey || null]
      )).rows[0] as any
    : fsCreateStep(runId, name, tool, inputs, idempotencyKey),
  getStep: async (id:string) => dataDriver() === 'db'
    ? (await pgQuery<StepRow>(`select * from nofx.step where id = $1`, [id])).rows[0]
    : fsGetStep(id),
  getStepByIdempotencyKey: async (runId:string, key:string) => dataDriver() === 'db'
    ? (await pgQuery<StepRow>(`select * from nofx.step where run_id=$1 and idempotency_key=$2`, [runId, key])).rows[0]
    : fsFindStepByIdempotencyKey(runId, key),
  updateStep: async (id:string, patch: Partial<StepRow>) => {
    if (dataDriver() !== 'db') return fsUpdateStep(id, patch);
    try {
      await pgQuery(`update nofx.step set status=coalesce($2,status), started_at=coalesce($3,started_at), ended_at=coalesce($4,ended_at), outputs=coalesce($5,outputs) where id=$1`, [id, (patch as any).status, (patch as any).started_at, (patch as any).ended_at, (patch as any).outputs]);
    } catch (e) {
      // Fallback to completed_at if ended_at column doesn't exist
      await pgQuery(`update nofx.step set status=coalesce($2,status), started_at=coalesce($3,started_at), completed_at=coalesce($4,completed_at), outputs=coalesce($5,outputs) where id=$1`, [id, (patch as any).status, (patch as any).started_at, (patch as any).ended_at || (patch as any).completed_at, (patch as any).outputs]);
    }
  },
  listStepsByRun: async (runId:string) => dataDriver() === 'db'
    ? (await pgQuery<StepRow>(`select * from nofx.step where run_id = $1 order by created_at`, [runId])).rows
    : fsListStepsByRun(runId),
  countRemainingSteps: async (runId:string) => dataDriver() === 'db'
    ? Number((await pgQuery<{ count: string }>(`select count(*)::int as count from nofx.step where run_id=$1 and status not in ('succeeded','cancelled')`, [runId])).rows[0].count)
    : fsCountRemainingSteps(runId),
  // events
  recordEvent: async (runId:string, type:string, payload:any={}, stepId?:string) => dataDriver() === 'db'
    ? pgQuery(`insert into nofx.event (run_id, type, payload) values ($1, $2, $3)`, [ runId, type, payload ])
    : fsRecordEvent(runId, type, payload, stepId),
  listEvents: async (runId:string) => dataDriver() === 'db'
    ? (await pgQuery<EventRow>(`select * from nofx.event where run_id = $1 order by created_at asc`, [runId])).rows
    : fsListEvents(runId),
  // gates
  createOrGetGate: async (runId:string, stepId:string, gateType:string) => dataDriver() === 'db'
    ? (await pgQuery<any>(`insert into nofx.gate (run_id, step_id, gate_type, status) values ($1,$2,$3,'pending') on conflict do nothing returning *`, [runId, stepId, gateType]))
    : fsCreateOrGetGate(runId, stepId, gateType),
  getLatestGate: async (runId:string, stepId:string) => dataDriver() === 'db'
    ? (await pgQuery<any>(`select * from nofx.gate where run_id=$1 and step_id=$2 order by created_at desc limit 1`, [runId, stepId])).rows[0]
    : fsGetLatestGate(runId, stepId),
  updateGate: async (gateId:string, patch: Partial<GateRow> & { run_id: string }) => dataDriver() === 'db'
    ? pgQuery(`update nofx.gate set status=$2, approved_by=coalesce($3, approved_by), approved_at=case when $3 is not null then now() else approved_at end where id=$1`, [gateId, (patch as any).status, (patch as any).approved_by || null])
    : fsUpdateGate(gateId, patch),
  listGatesByRun: async (runId:string) => dataDriver() === 'db'
    ? (await pgQuery<GateRow>(`select * from nofx.gate where run_id=$1 order by created_at asc`, [runId])).rows
    : fsListGatesByRun(runId),
  // artifacts
  addArtifact: async (stepId:string, type:string, pth:string, metadata?:any) => dataDriver() === 'db'
    ? pgQuery(`insert into nofx.artifact (step_id, type, path, metadata) values ($1,$2,$3,$4)`, [stepId, type, pth, metadata || {}])
    : fsAddArtifact(stepId, type, pth, metadata),
  listArtifactsByRun: async (runId:string) => dataDriver() === 'db'
    ? (await pgQuery<any>(`select a.*, s.name as step_name from nofx.artifact a join nofx.step s on s.id = a.step_id where s.run_id = $1`, [runId])).rows
    : fsListArtifactsByRun(runId),
  // inbox
  inboxMarkIfNew: async (key:string) => dataDriver() === 'db'
    ? Boolean((await pgQuery<any>(`insert into nofx.inbox (key) values ($1) on conflict do nothing returning id`, [key])).rows[0])
    : fsInboxMarkIfNew(key),
  // outbox
  outboxAdd: async (topic:string, payload:any) => dataDriver() === 'db'
    ? pgQuery(`insert into nofx.outbox (topic, payload) values ($1,$2)`, [topic, payload])
    : fsOutboxAdd(topic, payload),
  outboxListUnsent: async (limit=50) => dataDriver() === 'db'
    ? (await pgQuery<any>(`select id, topic, payload from nofx.outbox where sent=false order by created_at asc limit ${limit}`)).rows
    : fsOutboxListUnsent(limit),
  outboxMarkSent: async (id:string) => dataDriver() === 'db'
    ? pgQuery(`update nofx.outbox set sent=true, sent_at=now() where id=$1`, [id])
    : fsOutboxMarkSent(id),
};

export type { RunRow, StepRow };
