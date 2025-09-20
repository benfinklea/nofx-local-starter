import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { isAdmin } from '../../lib/auth';
import { getResponsesRuntime, getResponsesOperationsSummary, pruneResponsesOlderThanDays, retryResponsesRun } from '../../services/responses/runtime';
import type { RunRecord } from '../../shared/responses/archive';

function ensureAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'admin required' });
    return false;
  }
  return true;
}

function serializeRun(run: RunRecord | undefined) {
  if (!run) return run;
  return {
    runId: run.runId,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    model: run.request?.model,
    metadata: run.metadata ?? {},
    conversationId: run.conversationId,
  };
}

function serializeEvent(event: { sequence: number; type: string; payload: unknown; occurredAt: Date }) {
  return {
    sequence: event.sequence,
    type: event.type,
    payload: event.payload,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export default function mount(app: Express) {
  app.get('/responses/ops/summary', async (req, res) => {
    if (!ensureAdmin(req, res)) return;
    try {
      const summary = getResponsesOperationsSummary();
      res.json(summary);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to build summary' });
    }
  });

  app.post('/responses/ops/prune', async (req, res) => {
    if (!ensureAdmin(req, res)) return;
    try {
      const schema = z.object({ days: z.number().int().positive().max(365) });
      const parsed = schema.parse({
        days: typeof req.body?.days !== 'undefined' ? Number(req.body.days) : Number(req.query?.days ?? 0),
      });
      pruneResponsesOlderThanDays(parsed.days);
      res.json({ ok: true, summary: getResponsesOperationsSummary() });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'prune failed' });
    }
  });

  app.post('/responses/runs/:id/retry', async (req, res) => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const schema = z.object({
        tenantId: z.string().optional(),
        metadata: z.record(z.string()).optional(),
        background: z.boolean().optional(),
      });
      const parsed = schema.parse(req.body ?? {});
      const result = await retryResponsesRun(id, parsed);
      res.status(201).json({
        runId: result.runId,
        bufferedMessages: result.bufferedMessages,
        reasoning: result.reasoningSummaries,
        refusals: result.refusals,
        historyPlan: result.historyPlan,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      if (err instanceof Error && err.message === 'run not found') {
        return res.status(404).json({ error: 'not found' });
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'retry failed' });
    }
  });

  app.get('/responses/runs', async (req, res) => {
    if (!ensureAdmin(req, res)) return;
    try {
      const runtime = getResponsesRuntime();
      const runs = runtime.archive.listRuns().map(serializeRun);
      res.json({ runs });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to list runs' });
    }
  });

  app.get('/responses/runs/:id', async (req, res) => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const runtime = getResponsesRuntime();
      const timeline = runtime.archive.getTimeline(id);
      if (!timeline) return res.status(404).json({ error: 'not found' });

      res.json({
        run: serializeRun(timeline.run),
        events: timeline.events.map(serializeEvent),
        bufferedMessages: runtime.coordinator.getBufferedMessages(id),
        reasoning: runtime.coordinator.getBufferedReasoning(id),
        refusals: runtime.coordinator.getBufferedRefusals(id),
        rateLimits: runtime.tracker.getLastSnapshot(),
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to fetch run' });
    }
  });
}
