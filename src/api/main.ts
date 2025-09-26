import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from 'node:path';
import { z } from "zod";
import { PlanSchema } from "../shared/types";
import { CORS_ORIGINS } from '../config';
import { store } from "../lib/store";
import { log } from "../lib/logger";
import { enqueue, STEP_READY_TOPIC, hasSubscribers, getOldestAgeMs } from "../lib/queue";
import crypto from 'node:crypto';
import { recordEvent } from "../lib/events";
import { mountRouters } from './loader';
import builderRoutes from './routes/builder';
import responsesRoutes from './routes/responses';
import fs from 'node:fs';
import http from 'node:http';
import { initAutoBackupFromSettings } from '../lib/autobackup';
import startOutboxRelay from '../worker/relay';
import { requestObservability, setContext } from '../lib/observability';
import { initTracing } from '../lib/tracing';
import { getProject, updateProject } from '../lib/projects';
import { retryStep, StepNotFoundError, StepNotRetryableError } from '../lib/runRecovery';
import { isAdmin } from '../lib/auth';
import { toJsonObject } from '../lib/json';
import { shouldEnableDevRestartWatch } from '../lib/devRestart';
// New SaaS auth imports
import { requireAuth, optionalAuth, checkUsage, rateLimit, trackApiUsage } from '../auth/middleware';
import { trackUsage } from '../auth/supabase';
import authV2Routes from './routes/auth_v2';
import billingRoutes from './routes/billing';
import webhookRoutes from './routes/webhooks';
import teamsRoutes from './routes/teams';

dotenv.config();
export const app = express();
// Optional tracing (OpenTelemetry) if enabled via env
initTracing('nofx-api').catch(()=>{});
const devRestartWatch = shouldEnableDevRestartWatch();

// Enable CORS for frontend development
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-project-id']
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
// Cookie parser for auth
app.use(require('cookie-parser')());
// Observability middleware: request ID + latency logging + correlation
app.use(requestObservability);
// Add optional auth to all requests (populates req.user if authenticated)
app.use(optionalAuth);

// ADD view engine + static for future UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'ui', 'views'));
app.use('/ui/static', express.static(path.join(__dirname, '..', 'ui', 'static')));

// Optional: serve built SPA if present (apps/frontend/dist)
try {
  const feDist = path.join(process.cwd(), 'apps', 'frontend', 'dist');
  if (fs.existsSync(feDist)) {
    // Serve static assets from the built frontend with correct MIME types
    app.use('/ui/app', express.static(feDist, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
      }
    }));

    // Catch-all for SPA routing - only for non-asset requests
    app.get(/^\/ui\/app\/(?!.*\.(css|js|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json|map)).*$/, (_req, res) => {
      res.sendFile(path.join(feDist, 'index.html'));
    });
  }
} catch {}

app.get("/health", async (_req, res) => {
  try {
    // Test database connection
    const { query } = await import('../lib/db');
    await query('SELECT 1');
    res.json({ ok: true, database: { status: 'ok' } });
  } catch (error) {
    res.json({ ok: true, database: { status: 'error', error: 'Database connection failed' } });
  }
});

// Redirect /ui/app routes to Vite dev server in development
if (process.env.NODE_ENV === 'development') {
  app.get('/ui/app', (req, res) => {
    res.redirect('http://localhost:5173/ui/app/');
  });
  app.get('/ui/app/*', (req, res) => {
    const vitePath = req.originalUrl;
    res.redirect(`http://localhost:5173${vitePath}`);
  });
}

// Register builder routes eagerly so that operator tooling is immediately available
try {
  builderRoutes(app);
} catch {}

try {
  responsesRoutes(app);
} catch {}

// Ensure default project has local_path pointing to this repo for convenience in dev
void (async () => {
  try {
    const p = await getProject('default');
    if (p && (!p.local_path || String(p.local_path).trim() === '')) {
      await updateProject('default', { local_path: process.cwd(), workspace_mode: 'local_path' });
    }
  } catch {}
})();

const CreateRunSchema = z.object({ plan: PlanSchema, projectId: z.string().optional() });

// Preview a plan built from standard (plain-language) input
app.post('/runs/preview', async (req, res) => {
  try {
    if (req.body && req.body.standard) {
      const { prompt, quality = true, openPr = false, filePath, summarizeQuery, summarizeTarget } = req.body.standard || {};
      const built = await buildPlanFromPrompt(String(prompt||'').trim(), { quality, openPr, filePath, summarizeQuery, summarizeTarget });
      return res.json({ steps: built.steps, plan: built });
    }
    return res.status(400).json({ error: 'missing standard' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed to preview';
    return res.status(400).json({ error: message });
  }
});

// PROTECTED: Create run - requires authentication and checks usage limits
app.post("/runs",
  requireAuth,
  checkUsage('runs'),
  rateLimit(60000, 100), // 100 requests per minute max
  trackApiUsage('runs', 1),
  async (req, res) => {
  // Standard mode: build a plan from plain-language prompt and settings
  if (req.body && req.body.standard) {
    try {
      const { prompt, quality = true, openPr = false, filePath, summarizeQuery, summarizeTarget } = req.body.standard || {};
      const built = await buildPlanFromPrompt(String(prompt||'').trim(), { quality, openPr, filePath, summarizeQuery, summarizeTarget });
      req.body = { plan: built };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'bad standard request';
      return res.status(400).json({ error: message });
    }
  }
  const parsed = CreateRunSchema.safeParse({ ...req.body, projectId: req.body?.projectId || (req.headers['x-project-id'] as string|undefined) });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { plan, projectId = 'default' } = parsed.data;

  // Add user context to the run
  const runData = {
    ...plan,
    user_id: req.userId,
    metadata: {
      ...plan.metadata,
      created_by: req.userId,
      tier: req.userTier
    }
  };
  const run = await store.createRun(runData, projectId);
  const runId = String(run.id);
  try { setContext({ runId, projectId }); } catch {}
  await recordEvent(runId, "run.created", { plan });

  // Respond immediately to avoid request timeouts on large plans
  res.status(201).json({ id: runId, status: "queued", projectId });

  // Process steps asynchronously (fire-and-forget)
  void (async () => {
    for (const s of plan.steps) {
      // Preserve optional per-step security policy by embedding into inputs
      const baseInputs = toJsonObject(s.inputs ?? {});
      const policy = toJsonObject({
        tools_allowed: s.tools_allowed,
        env_allowed: s.env_allowed,
        secrets_scope: s.secrets_scope,
      });
      const inputsWithPolicy = {
        ...baseInputs,
        ...(Object.keys(policy).length ? { _policy: policy } : {}),
      };
      // Idempotency key: `${runId}:${stepName}:${hash(inputs)}`
      const hash = crypto.createHash('sha256').update(JSON.stringify(inputsWithPolicy)).digest('hex').slice(0, 12);
      const idemKey = `${runId}:${s.name}:${hash}`;
      const created = await store.createStep(runId, s.name, s.tool, inputsWithPolicy, idemKey);
      let stepId = created?.id;
      let existing = created;
      if (!existing) {
        existing = await store.getStepByIdempotencyKey(runId, idemKey);
        if (!stepId) stepId = existing?.id;
      }
      if (!existing && stepId) {
        existing = await store.getStep(stepId);
      }
      if (!stepId || !existing) continue; // safety: skip if we couldn't resolve step id
      try { setContext({ stepId }); } catch {}
      await recordEvent(runId, "step.enqueued", { name: s.name, tool: s.tool, idempotency_key: idemKey }, stepId);
      // Enqueue unless step is already finished; rely on worker inbox for exactly-once
      const status = String((existing as { status?: string }).status || '').toLowerCase();
      if (!['succeeded','cancelled'].includes(status)) {
        // Backpressure: delay enqueue when queue age grows beyond threshold
        const thresholdMs = Math.max(0, Number(process.env.BACKPRESSURE_AGE_MS || 5000));
        const ageMs = getOldestAgeMs(STEP_READY_TOPIC);
        let delayMs = 0;
        if (ageMs != null && ageMs > thresholdMs) {
          delayMs = Math.min(Math.floor((ageMs - thresholdMs) / 2), 15000);
          await recordEvent(runId, 'queue.backpressure', { ageMs, delayMs }, stepId);
        }
        await enqueue(STEP_READY_TOPIC, { runId, stepId, idempotencyKey: idemKey, __attempt: 1 }, delayMs ? { delay: delayMs } : undefined);
      }
      // Simple Mode fallback: run inline to avoid any queue hiccups
      const inlineRunnerDisabled = process.env.DISABLE_INLINE_RUNNER === '1';
      const usingMemoryQueue = (process.env.QUEUE_DRIVER || 'memory').toLowerCase() === 'memory';
      if (usingMemoryQueue && !inlineRunnerDisabled && !hasSubscribers(STEP_READY_TOPIC)) {
        // Lazy import to avoid cycle
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { runStep } = require('../worker/runner');
        setTimeout(() => { try { runStep(runId, stepId!); } catch {} }, 5);
      }
    }
  })().catch(() => {});
});

// PROTECTED: Get run details - requires auth and ownership
app.get("/runs/:id",
  requireAuth,
  async (req, res) => {
  const runId = req.params.id;
  const run = await store.getRun(runId);
  if (!run) return res.status(404).json({ error: "not found" });

  // Check ownership (unless admin)
  if (run.user_id && run.user_id !== req.userId) {
    const isUserAdmin = req.user && (await store.getUserRole(req.userId)) === 'admin';
    if (!isUserAdmin) {
      return res.status(403).json({ error: "access denied" });
    }
  }
  const steps = await store.listStepsByRun(runId);
  const artifacts = await store.listArtifactsByRun(runId);
  res.json({ run, steps, artifacts });
});

app.get("/runs/:id/timeline", async (req, res) => {
  const runId = req.params.id;
  const ev = await store.listEvents(runId);
  res.json(ev);
});

// SSE stream of timeline events (naive polling -> push)
app.get('/runs/:id/stream', async (req, res) => {
  const runId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  let closed = false;
  req.on('close', () => { closed = true; });
  let lastIdx = 0;
  // Initial burst
  try {
    const initial = await store.listEvents(runId);
    lastIdx = initial.length;
    res.write(`event: init\n`);
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch {}
  const iv = setInterval(async () => {
    if (closed) { clearInterval(iv); return; }
    try {
      const all = await store.listEvents(runId);
      if (all.length > lastIdx) {
        const delta = all.slice(lastIdx);
        lastIdx = all.length;
        res.write(`event: append\n`);
        res.write(`data: ${JSON.stringify(delta)}\n\n`);
      }
    } catch {}
  }, 1000);
});

// PROTECTED: List user's runs - requires auth, shows only user's runs
app.get('/runs',
  requireAuth,
  rateLimit(60000, 200),
  async (req, res) => {
  const lim = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
  const projectId = String(req.query.projectId || '');
  try {
    // Filter runs by user (unless admin)
    const isUserAdmin = req.user && (await store.getUserRole(req.userId)) === 'admin';
    const rows = isUserAdmin
      ? await store.listRuns(lim, projectId || undefined)
      : await store.listRunsByUser(req.userId!, lim, projectId || undefined);
    res.json({ runs: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed to list runs';
    res.status(500).json({ error: msg });
  }
});

// Mount auth and billing routes BEFORE other routes
authV2Routes(app);
billingRoutes(app);
webhookRoutes(app);
teamsRoutes(app);

// ADD at the end of file, after existing routes:
mountRouters(app);

const port = Number(process.env.PORT || 3000);
function listenWithRetry(attempt = 0) {
  const server = http.createServer(app);
  server.once('error', (err: unknown) => {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EADDRINUSE') {
      const delay = 500 + attempt*250;
      if (attempt < 4) {
        log.warn({ attempt, delay }, 'Port in use; retrying listen');
        setTimeout(() => listenWithRetry(attempt+1), delay);
      } else {
        log.warn('Port still in use after retries');
        if (devRestartWatch) {
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

app.post('/runs/:runId/steps/:stepId/retry', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'auth required', login: '/ui/login' });
  }
  const { runId, stepId } = req.params;
  try {
    await retryStep(runId, stepId);
    res.status(202).json({ ok: true });
  } catch (err) {
    if (err instanceof StepNotFoundError) {
      return res.status(404).json({ error: 'step not found' });
    }
    if (err instanceof StepNotRetryableError) {
      return res.status(409).json({ error: err.message });
    }
    log.error({ err, runId, stepId }, 'step.retry.error');
    return res.status(500).json({ error: 'retry failed' });
  }
});
if (process.env.NODE_ENV !== 'test') {
  listenWithRetry();
}

// Dev-only restart watcher: if flag file changes, exit to let ts-node-dev respawn
if (process.env.NODE_ENV !== 'test' && devRestartWatch) {
  const flagPath = path.join(process.cwd(), '.dev-restart-api');
  const startedAt = Date.now();
  let last = 0;
  // Clean up stale flag from previous run
  try { const st = fs.statSync(flagPath); if (st.mtimeMs <= startedAt) fs.unlinkSync(flagPath); } catch {}
  const interval = setInterval(() => {
    try {
      const stat = fs.statSync(flagPath);
      const m = stat.mtimeMs;
      if (m > startedAt && m > last) { last = m; log.info('Dev restart flag changed; exiting'); process.exit(0); }
    } catch {
      // ignore missing flag or stat errors in dev restart watcher
    }
  }, 1500);
  interval.unref();
}

// Build a plan from simple prompt using Settings
import { buildPlanFromPrompt } from './planBuilder';

export default app;

// Background: optional periodic backups driven by Settings
initAutoBackupFromSettings().catch(()=>{});
// Start outbox relay for event fan-out (non-blocking)
try { startOutboxRelay(); } catch {}
