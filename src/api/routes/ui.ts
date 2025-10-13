import type { Express } from 'express';
import { store } from '../../lib/store';
import { supabase, ARTIFACT_BUCKET } from '../../lib/supabase';
import { getSettings, type Settings } from '../../lib/settings';
import { listModels, type ModelRow } from '../../lib/models';
import { isAdmin } from '../../lib/auth';
import { BuilderTemplateManager } from '../../services/builder/builderManager';
import { getResponsesRuntime, getResponsesOperationsSummary, getRunIncidents } from '../../services/responses/runtime';
import type { SafetySnapshot } from '../../shared/responses/archive';
import { runsReactEnabled, builderReactEnabled, settingsReactEnabled, responsesReactEnabled } from '../../lib/uiFlags';

const builderManager = new BuilderTemplateManager();

export default function mount(app: Express){
  // Login page - redirects to dev login in dev/test, otherwise shows login form
  app.get('/ui/login', async (req, res) => {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // In dev/test mode, redirect to auto-login
      const next = (req.query.next as string) || '/ui/settings';
      return res.redirect(`/dev/login?next=${encodeURIComponent(next)}`);
    }
    // In production, render login page (you'd need to create this template)
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Login</title></head>
      <body>
        <h1>Login</h1>
        <form method="GET" action="/dev/login">
          <input type="password" name="password" placeholder="Password" required />
          <input type="submit" value="Login" />
        </form>
      </body>
      </html>
    `);
  });

  app.get('/ui/runs', async (_req, res) => {
    if (runsReactEnabled) {
      return res.redirect('/ui/app/#/runs');
    }
    const rows = await store.listRuns(100);
    return res.render('runs', { runs: rows });
  });
  // Place the 'new' route BEFORE the ':id' route to avoid param capture
  app.get('/ui/runs/new', async (_req, res) => {
    if (runsReactEnabled) {
      return res.redirect('/ui/app/#/runs/new');
    }
    return res.render('new_run');
  });
  app.get('/ui/runs/:id', async (req, res) => {
    if (runsReactEnabled) {
      return res.redirect(`/ui/app/#/runs/${encodeURIComponent(req.params.id)}`);
    }
    const runId = req.params.id;
    const run = await store.getRun(runId);
    if (!run) {
      // Graceful fallback if run not yet persisted (FS lag) or missing
      return res.render('run', { run: { id: runId, status: 'queued' }, artifacts: [], gates: [] });
    }
    const artifacts = await store.listArtifactsByRun(runId);
    const gates = await store.listGatesByRun(runId);
    return res.render('run', { run, artifacts, gates });
  });
  app.get('/ui/settings', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    if (settingsReactEnabled) {
      return res.redirect('/ui/app/#/settings');
    }
    let settings: Settings | null = null; let models: ModelRow[] = [];
    try { settings = await getSettings(); } catch {}
    try { models = await listModels(); } catch {}
    return res.render('settings', { preloaded: { settings, models } });
  });
  app.get('/ui/dev', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    return res.render('dev_settings');
  });
  app.get('/ui/models', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    if (settingsReactEnabled) {
      return res.redirect('/ui/app/#/models');
    }
    return res.render('models');
  });
  app.get('/ui/builder', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    if (builderReactEnabled) {
      return res.redirect('/ui/app/#/builder');
    }
    let templates = [] as unknown[];
    let responsesRuns = [] as unknown[];
    try { templates = await builderManager.listTemplates(); } catch {}
    try {
      const runtime = getResponsesRuntime();
      responsesRuns = runtime.archive.listRuns().map((run) => ({
        runId: run.runId,
        status: run.status,
        model: run.request?.model,
        createdAt: run.createdAt.toISOString(),
      }));
    } catch {}
    return res.render('builder', { preloaded: { templates, responsesRuns } });
  });
  app.get('/ui/responses', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    if (responsesReactEnabled) {
      return res.redirect(`/ui/app/#/responses`);
    }
    const runtime = getResponsesRuntime();
    let runs = [] as unknown[];
    let summary: unknown = null;
    try {
      runs = runtime.archive.listRuns().map((run) => ({
        runId: run.runId,
        status: run.status,
        model: run.request?.model,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        metadata: run.metadata ?? {},
      }));
      summary = getResponsesOperationsSummary();
    } catch {}
    return res.render('responses_runs', { preloaded: { runs, summary } });
  });
  app.get('/ui/responses/:id', async (req, res) => {
    if (!isAdmin(req)) return res.redirect('/ui/login');
    const { id } = req.params;
    if (responsesReactEnabled) {
      return res.redirect(`/ui/app/#/responses/${encodeURIComponent(id)}`);
    }
    const runtime = getResponsesRuntime();
    const timeline = runtime.archive.getTimeline(id);
    if (!timeline) {
      return res.render('responses_run', {
        preloaded: {
          run: {
            runId: id,
            status: 'unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            safety: { hashedIdentifier: undefined, refusalCount: 0, moderatorNotes: [] },
          },
          events: [],
          bufferedMessages: [],
          reasoning: [],
          refusals: [],
          outputAudio: [],
          outputImages: [],
          inputTranscripts: [],
          delegations: [],
          incidents: [],
        },
      });
    }
    return res.render('responses_run', {
      preloaded: {
        run: {
          runId: timeline.run.runId,
          status: timeline.run.status,
          model: timeline.run.request?.model,
          metadata: timeline.run.metadata ?? {},
          createdAt: timeline.run.createdAt.toISOString(),
          updatedAt: timeline.run.updatedAt.toISOString(),
          traceId: timeline.run.traceId,
          safety: serializeSafety(timeline.run.safety),
        },
        events: timeline.events.map((event) => ({
          sequence: event.sequence,
          type: event.type,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
        })),
        bufferedMessages: runtime.coordinator.getBufferedMessages(id),
        reasoning: runtime.coordinator.getBufferedReasoning(id),
        refusals: runtime.coordinator.getBufferedRefusals(id),
        outputAudio: runtime.coordinator.getBufferedOutputAudio(id),
        outputImages: runtime.coordinator.getBufferedImages(id),
        inputTranscripts: runtime.coordinator.getBufferedInputTranscripts(id),
        delegations: runtime.coordinator.getDelegations(id),
        incidents: getRunIncidents(id),
      },
    });
  });
  app.get('/ui/artifacts/signed', async (req, res) => {
    const pth = String(req.query.path || '');
    if (store.driver === 'fs') {
      // Prevent path traversal: resolve and ensure within base directory
      const path = require('node:path');
      const base = path.resolve(process.cwd(), 'local_data');
      const candidate = path.resolve(base, pth.replace(/^\/+/, ''));
      if (!candidate.startsWith(base + path.sep) && candidate !== base) {
        return res.status(400).send('invalid path');
      }
      return res.sendFile(candidate, (err: unknown) => { if (err) res.status(404).send('not found'); });
    }
    const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).createSignedUrl(pth, 3600);
    if (error || !data) return res.status(404).send('not found');
    return res.redirect(data.signedUrl);
  });
}

function serializeSafety(safety?: SafetySnapshot) {
  if (!safety) return { hashedIdentifier: undefined, refusalCount: 0, moderatorNotes: [] };
  return {
    hashedIdentifier: safety.hashedIdentifier,
    refusalCount: safety.refusalCount,
    lastRefusalAt: safety.lastRefusalAt ? safety.lastRefusalAt.toISOString() : undefined,
    moderatorNotes: safety.moderatorNotes.map((note) => ({
      reviewer: note.reviewer,
      note: note.note,
      disposition: note.disposition,
      recordedAt: note.recordedAt.toISOString(),
    })),
  };
}
