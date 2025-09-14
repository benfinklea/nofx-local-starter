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
import http from 'node:http';

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

// Preview a plan built from standard (plain-language) input
app.post('/runs/preview', async (req, res) => {
  try {
    if (req.body && req.body.standard) {
      const { prompt, quality = true, openPr = false, filePath, summarizeQuery, summarizeTarget } = req.body.standard || {};
      const built = await buildPlanFromPrompt(String(prompt||'').trim(), { quality, openPr, filePath, summarizeQuery, summarizeTarget } as any);
      return res.json({ steps: built.steps, plan: built });
    }
    return res.status(400).json({ error: 'missing standard' });
  } catch (e:any) {
    return res.status(400).json({ error: e.message || 'failed to preview' });
  }
});

app.post("/runs", async (req, res) => {
  // Standard mode: build a plan from plain-language prompt and settings
  if (req.body && req.body.standard) {
    try {
      const { prompt, quality = true, openPr = false, filePath, summarizeQuery, summarizeTarget } = req.body.standard || {};
      const built = await buildPlanFromPrompt(String(prompt||'').trim(), { quality, openPr, filePath, summarizeQuery, summarizeTarget } as any);
      req.body = { plan: built };
    } catch (e:any) {
      return res.status(400).json({ error: e.message || 'bad standard request' });
    }
  }
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

const port = Number(process.env.PORT || 3000);
function listenWithRetry(attempt=0){
  const server = http.createServer(app);
  server.once('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      const delay = 500 + attempt*250;
      if (attempt < 4) {
        log.warn({ attempt, delay }, 'Port in use; retrying listen');
        setTimeout(() => listenWithRetry(attempt+1), delay);
      } else {
        log.warn('Port still in use after retries');
        if (process.env.DEV_RESTART_WATCH === '1') {
          log.warn('Dev mode: exiting to allow clean restart');
          process.exit(0);
        }
        throw err;
      }
    } else {
      throw err;
    }
  });
  server.listen(port, () => log.info(`API listening on :${port}`));
}
listenWithRetry();

// Dev-only restart watcher: if flag file changes, exit to let ts-node-dev respawn
if (process.env.DEV_RESTART_WATCH === '1') {
  const flagPath = path.join(process.cwd(), '.dev-restart-api');
  let last = 0;
  setInterval(() => {
    try {
      const stat = fs.statSync(flagPath);
      const m = stat.mtimeMs;
      if (m > last) { last = m; log.info('Dev restart flag changed; exiting'); process.exit(0); }
    } catch {}
  }, 1500);
}

// Build a plan from simple prompt using Settings
import { getSettings } from "../lib/settings";
function guessTopicFromPrompt(p:string){
  if (!p) return 'NOFX';
  // simple heuristic: take first sentence or 6 words
  const m = p.split(/[\.\n]/)[0] || p;
  const words = m.trim().split(/\s+/).slice(0, 8).join(' ');
  return words || 'NOFX';
}
async function buildPlanFromPrompt(prompt: string, opts: { quality: boolean; openPr: boolean; filePath?: string; summarizeQuery?: string; summarizeTarget?: string }){
  const { gates } = await getSettings();
  const steps: any[] = [];
  if (opts.quality) {
    if (gates.typecheck) steps.push({ name: 'typecheck', tool: 'gate:typecheck' });
    if (gates.lint) steps.push({ name: 'lint', tool: 'gate:lint' });
    if (gates.unit) steps.push({ name: 'unit', tool: 'gate:unit' });
  }
  const topic = guessTopicFromPrompt(prompt);
  const hinted = guessMarkdownPath(prompt);
  const targetPath = (opts.filePath && String(opts.filePath).trim()) || hinted || 'README.md';
  const filename = targetPath.split('/').pop() || 'README.md';
  steps.push({ name: 'write readme', tool: 'codegen', inputs: { topic, bullets: ['Control plane','Verification','Workers'], filename } });
  if (opts.summarizeQuery && (opts.summarizeTarget || /summarize/i.test(prompt))) {
    const sumPath = String(opts.summarizeTarget || 'docs/summary.md');
    const sumName = sumPath.split('/').pop() || 'summary.md';
    steps.push({ name: 'summarize', tool: 'codegen', inputs: { topic: `Summarize: ${opts.summarizeQuery}`, bullets: ['Key points','Action items','References'], filename: sumName } });
    if (opts.openPr) {
      steps.push({ name: 'open pr (summary)', tool: 'git_pr', inputs: { branch: `feat/summary-${Date.now().toString().slice(-4)}`, base: 'main', title: `docs: summary of ${opts.summarizeQuery}`, commits: [ { path: sumPath, fromStep: 'summarize', artifactName: sumName } ] } });
    }
  }
  if (opts.openPr === true || (opts.openPr === undefined && /\bopen a pr\b/i.test(prompt))) {
    const branchBase = topic.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24) || 'update-docs';
    steps.push({ name: 'open pr', tool: 'git_pr', inputs: { branch: `feat/${branchBase}`, base: 'main', title: `docs: ${topic}`, commits: [ { path: targetPath, fromStep: 'write readme', artifactName: filename } ] } });
  }
  // If prompt mentions manual approval, add a manual gate
  if (/manual approval|human approve|require approval/i.test(prompt)) {
    steps.unshift({ name: 'approval', tool: 'manual:deploy' });
  }
  return { goal: prompt || 'ad-hoc run', steps };
}

function guessMarkdownPath(p: string): string | undefined {
  if (!p) return undefined;
  const m = p.match(/(?:^|\s)([\w\-/.]+\.md)\b/i);
  if (m) return m[1];
  if (/\bin docs\b/i.test(p)) return 'docs/README.md';
  return undefined;
}
