import express from "express";
import dotenv from "dotenv";
import path from 'node:path';
import { z } from "zod";
import { PlanSchema } from "../shared/types";
import { query } from "../lib/db";
import { log } from "../lib/logger";
import { enqueue, STEP_READY_TOPIC } from "../lib/queue";
import { recordEvent } from "../lib/events";
import { mountRouters } from './loader';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ADD view engine + static for future UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'ui', 'views'));
app.use('/ui/static', express.static(path.join(__dirname, '..', 'ui', 'static')));

app.get("/health", (_req, res) => res.json({ ok: true }));

const CreateRunSchema = z.object({ plan: PlanSchema });

app.post("/runs", async (req, res) => {
  const parsed = CreateRunSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { plan } = parsed.data;

  const run = await query<{ id: string }>(
    `insert into nofx.run (plan, status) values ($1, 'queued') returning id`,
    [plan]
  );
  const runId = run.rows[0].id;
  await recordEvent(runId, "run.created", { plan });

  for (const s of plan.steps) {
    const step = await query<{ id: string }>(
      `insert into nofx.step (run_id, name, tool, inputs, status) values ($1,$2,$3,$4,'queued') returning id`,
      [runId, s.name, s.tool, s.inputs || {}]
    );
    const stepId = step.rows[0].id;
    await recordEvent(runId, "step.enqueued", { name: s.name, tool: s.tool }, stepId);
    await enqueue(STEP_READY_TOPIC, { runId, stepId });
  }

  res.status(201).json({ id: runId, status: "queued" });
});

app.get("/runs/:id", async (req, res) => {
  const runId = req.params.id;
  const run = await query<any>(`select * from nofx.run where id = $1`, [runId]);
  if (!run.rows[0]) return res.status(404).json({ error: "not found" });
  const steps = await query<any>(`select * from nofx.step where run_id = $1 order by created_at`, [runId]).catch(async () => {
    // created_at might not exist; fallback order by started/ended
    const s = await query<any>(`select * from nofx.step where run_id = $1`, [runId]);
    return s;
  });
  const artifacts = await query<any>(
    `select a.*, s.name as step_name from nofx.artifact a join nofx.step s on s.id = a.step_id where s.run_id = $1`, [runId]
  );
  res.json({ run: run.rows[0], steps: steps.rows, artifacts: artifacts.rows });
});

app.get("/runs/:id/timeline", async (req, res) => {
  const runId = req.params.id;
  const ev = await query<any>(`select * from nofx.event where run_id = $1 order by timestamp asc`, [runId]);
  res.json(ev.rows);
});

// ADD at the end of file, after existing routes:
mountRouters(app);

const port = process.env.PORT || 3000;
app.listen(port, () => log.info(`API listening on :${port}`));

// Dev-only restart watcher: if flag file changes, exit to let ts-node-dev respawn
if (process.env.DEV_RESTART_WATCH === '1') {
  const flagPath = path.join(process.cwd(), '.dev-restart');
  let last = 0;
  setInterval(() => {
    try {
      const stat = fs.statSync(flagPath);
      const m = stat.mtimeMs;
      if (m > last) { last = m; log.info('Dev restart flag changed; exiting'); process.exit(0); }
    } catch {}
  }, 1500);
}
