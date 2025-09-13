# 30_APPROVALS — Manual Gates + Approvals

**Depends on:** 00_BASE

## Files to add
- `supabase/migrations/0002_gates.sql`
- `src/api/routes/gates.ts`
- `src/worker/handlers/manual.ts`

### 1) Migration
`supabase/migrations/0002_gates.sql`
```sql
create table if not exists nofx.gate (
  id uuid primary key default uuid_generate_v4(),
  tenant_id text not null default 'local',
  run_id uuid not null references nofx.run(id) on delete cascade,
  step_id uuid references nofx.step(id) on delete cascade,
  gate_type text not null,
  status text not null check (status in ('pending','passed','failed','waived')) default 'pending',
  evidence_uri text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gate_run_idx on nofx.gate(run_id);
```

### 2) API routes
`src/api/routes/gates.ts`
```ts
import type { Express } from 'express';
import { query } from '../../lib/db';

export default function mount(app: Express){
  app.post('/gates', async (req, res) => {
    const { runId, stepId, gateType, evidenceUri } = req.body || {};
    const q = await query<any>(
      `insert into nofx.gate (run_id, step_id, gate_type, evidence_uri) values ($1,$2,$3,$4) returning *`,
      [runId, stepId || null, gateType, evidenceUri || null]
    );
    res.status(201).json(q.rows[0]);
  });
  app.post('/gates/:id/approve', async (req, res) => {
    const id = req.params.id;
    const q = await query<any>(
      `update nofx.gate set status='passed', approved_by='local-user', approved_at=now() where id=$1 returning *`, [id]
    );
    res.json(q.rows[0] || {});
  });
  app.post('/gates/:id/waive', async (req, res) => {
    const id = req.params.id;
    const q = await query<any>(
      `update nofx.gate set status='waived', approved_by='local-user', approved_at=now() where id=$1 returning *`, [id]
    );
    res.json(q.rows[0] || {});
  });
  app.get('/runs/:id/gates', async (req,res) => {
    const r = await query<any>(`select * from nofx.gate where run_id=$1 order by created_at asc`, [req.params.id]);
    res.json(r.rows);
  });
}
```

### 3) Manual gate handler (wait until approved)
`src/worker/handlers/manual.ts`
```ts
import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";

async function waitForGate(runId: string, gateType: string) {
  const row = await query<any>(
    `insert into nofx.gate (run_id, gate_type, status) values ($1,$2,'pending') returning id`, [runId, gateType]
  );
  const id = row.rows[0].id;
  await recordEvent(runId, 'gate.pending', { gateType, id });
  for (;;) {
    const g = await query<any>(`select status from nofx.gate where id=$1`, [id]);
    const s = g.rows[0]?.status;
    if (s && s !== 'pending') {
      await recordEvent(runId, `gate.${s}`, { gateType, id });
      return s === 'passed' || s === 'waived';
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

const handler: StepHandler = {
  match: (tool) => tool === 'manual:deploy' || tool === 'manual:db',
  async run({ runId, step }) {
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [step.id]);
    const ok = await waitForGate(runId, step.tool);
    await query(`update nofx.step set status=$2, ended_at=now() where id=$1`, [step.id, ok ? 'succeeded':'failed']);
    if (!ok) throw new Error(`gate ${step.tool} not approved`);
  }
};
export default handler;
```

## Done
Commit: `feat(approvals): manual gates + API + handler`
