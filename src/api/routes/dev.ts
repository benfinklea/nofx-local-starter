import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { isAdmin } from '../../lib/auth';
import { exec } from 'node:child_process';
import net from 'node:net';
import { enableTracing, disableTracing, tracingStatus } from '../../lib/tracing';
import { metrics } from '../../lib/metrics';

function isProd() { return process.env.NODE_ENV === 'production'; }
function requireAdmin(req: Request, res: Response) {
  if (isProd()) { res.status(404).json({ error: 'not found' }); return false; }
  if (!isAdmin(req)) { res.status(401).json({ error: 'auth required' }); return false; }
  return true;
}

function run(cmd: string, cwd: string): Promise<{ code:number; stdout:string; stderr:string }>{
  return new Promise((resolve) => {
    const child = exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve({ code: err ? 1 : 0, stdout: String(stdout||''), stderr: String(stderr||'') });
    });
    child.on('error', () => resolve({ code: 1, stdout: '', stderr: 'spawn error' }));
  });
}

function checkPort(host: string, port: number, timeoutMs=600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const to = setTimeout(() => {
      try { socket.destroy(); } catch {}
      resolve(false);
    }, timeoutMs);
    socket.on('connect', () => {
      clearTimeout(to);
      try { socket.destroy(); } catch {}
      resolve(true);
    });
    socket.on('error', () => { clearTimeout(to); resolve(false); });
  });
}

export default function mount(app: Express){
  app.post('/dev/restart', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const apiFlag = path.join(process.cwd(), '.dev-restart-api');
      const workerFlag = path.join(process.cwd(), '.dev-restart-worker');
      const now = String(Date.now());
      fs.writeFileSync(apiFlag, now);
      fs.writeFileSync(workerFlag, now);
      res.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'restart failed';
      res.status(500).json({ error: message });
    }
  });

  app.post('/dev/restart/api', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const apiFlag = path.join(process.cwd(), '.dev-restart-api');
      fs.writeFileSync(apiFlag, String(Date.now()));
      res.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'restart failed';
      res.status(500).json({ error: message });
    }
  });

  app.post('/dev/restart/worker', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const workerFlag = path.join(process.cwd(), '.dev-restart-worker');
      fs.writeFileSync(workerFlag, String(Date.now()));
      res.json({ ok: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'restart failed';
      res.status(500).json({ error: message });
    }
  });

  // Observability stack controls (docker compose up/down)
  app.get('/dev/observability/status', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const [prom, graf, otel] = await Promise.all([
      checkPort('127.0.0.1', 9090),
      checkPort('127.0.0.1', 3001),
      checkPort('127.0.0.1', 4318)
    ]);
    res.json({ prometheus: prom, grafana: graf, otel_collector: otel });
  });
  app.post('/dev/observability/up', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const cwd = path.join(process.cwd(), 'docs', 'observability');
    // Try `docker compose`, then fallback to `docker-compose`
    const first = await run('docker compose up -d', cwd);
    if (first.code === 0) return res.json({ ok: true, engine: 'docker compose', logs: first.stdout });
    const second = await run('docker-compose up -d', cwd);
    if (second.code === 0) return res.json({ ok: true, engine: 'docker-compose', logs: second.stdout });
    res.status(500).json({ error: 'failed to start observability stack', logs: first.stderr + '\n' + second.stderr });
  });
  app.post('/dev/observability/down', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const cwd = path.join(process.cwd(), 'docs', 'observability');
    const first = await run('docker compose down -v', cwd);
    if (first.code === 0) return res.json({ ok: true, engine: 'docker compose', logs: first.stdout });
    const second = await run('docker-compose down -v', cwd);
    if (second.code === 0) return res.json({ ok: true, engine: 'docker-compose', logs: second.stdout });
    res.status(500).json({ error: 'failed to stop observability stack', logs: first.stderr + '\n' + second.stderr });
  });

  // Tracing controls (API process only)
  app.get('/dev/tracing/status', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json(tracingStatus());
  });
  app.post('/dev/tracing/enable', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try { await enableTracing('nofx-api'); return res.json({ ok: true }); } catch (e:any) { return res.status(500).json({ error: e?.message || 'failed' }); }
  });
  app.post('/dev/tracing/disable', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try { await disableTracing(); return res.json({ ok: true }); } catch (e:any) { return res.status(500).json({ error: e?.message || 'failed' }); }
  });

  // Alert tests (synthetic). Dev only; writes metrics directly for short duration.
  let queueDepthTimer: NodeJS.Timeout | null = null;
  let errorRateTimer: NodeJS.Timeout | null = null;
  app.post('/dev/alerts/test/queue-depth', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const durationMs = Math.max(5_000, Math.min(300_000, Number((req.body?.durationMs) || 60_000)));
    const target = Math.max(1, Math.min(500, Number((req.body?.target) || 60)));
    if (queueDepthTimer) { clearInterval(queueDepthTimer); queueDepthTimer = null; }
    const end = Date.now() + durationMs;
    queueDepthTimer = setInterval(() => {
      try {
        const val = Date.now() < end ? target : 0;
        metrics.queueDepth.set({ topic: 'step.ready', state: 'waiting' }, val);
        metrics.queueOldestAgeMs.set({ topic: 'step.ready' }, val > 0 ? 6 * 60_000 : 0);
        if (Date.now() >= end && queueDepthTimer) { clearInterval(queueDepthTimer); queueDepthTimer = null; }
      } catch {}
    }, 1000);
    res.json({ ok: true, durationMs, target });
  });
  app.post('/dev/alerts/test/error-rate', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const durationMs = Math.max(5_000, Math.min(300_000, Number((req.body?.durationMs) || 60_000)));
    const failPct = Math.max(1, Math.min(90, Number((req.body?.failPct) || 10))); // default 10%
    if (errorRateTimer) { clearInterval(errorRateTimer); errorRateTimer = null; }
    const perTick = 5; // 5 samples per second
    const failPerTick = Math.max(1, Math.floor((perTick * failPct) / 100));
    const end = Date.now() + durationMs;
    errorRateTimer = setInterval(() => {
      try {
        for (let i=0;i<perTick;i++) metrics.stepsTotal.inc({ status: 'succeeded' }, 1);
        for (let i=0;i<failPerTick;i++) metrics.stepsTotal.inc({ status: 'failed' }, 1);
        if (Date.now() >= end && errorRateTimer) { clearInterval(errorRateTimer); errorRateTimer = null; }
      } catch {}
    }, 1000);
    res.json({ ok: true, durationMs, failPct });
  });
}
