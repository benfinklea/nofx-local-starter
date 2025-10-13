import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { isAdmin } from '../../lib/auth';
import {
  getResponsesRuntime,
  getResponsesOperationsSummary,
  pruneResponsesOlderThanDays,
  retryResponsesRun,
  listResponseIncidents,
  resolveResponseIncident,
  addResponsesModeratorNote,
  exportResponsesRun,
  getRunIncidents,
  rollbackResponsesRun,
} from '../../services/responses/runtime';
import type { RunRecord, ModeratorNote } from '../../shared/responses/archive';
import { log } from '../../lib/logger';

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
    traceId: run.traceId,
    safety: serializeSafety(run.safety),
    tenantId: run.metadata?.tenant_id ?? run.metadata?.tenantId,
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

function serializeSafety(safety?: RunRecord['safety']) {
  if (!safety) return undefined;
  return {
    hashedIdentifier: safety.hashedIdentifier,
    refusalCount: safety.refusalCount,
    lastRefusalAt: safety.lastRefusalAt ? safety.lastRefusalAt.toISOString() : undefined,
    moderatorNotes: safety.moderatorNotes.map(serializeModeratorNote),
  };
}

function serializeModeratorNote(note: ModeratorNote) {
  return {
    reviewer: note.reviewer,
    note: note.note,
    disposition: note.disposition,
    recordedAt: note.recordedAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeIncident(incident: any) {
  return {
    ...incident,
    occurredAt: typeof incident.occurredAt === 'string' ? incident.occurredAt : incident.occurredAt?.toISOString(),
    resolvedAt: incident.resolvedAt instanceof Date ? incident.resolvedAt.toISOString() : incident.resolvedAt,
  };
}

export default function mount(app: Express) {
  app.get('/responses/ops/summary', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const summary = getResponsesOperationsSummary();
      res.json(summary);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to build summary' }); return;
    }
  });

  app.get('/responses/ops/incidents', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const status = typeof req.query.status === 'string' ? (req.query.status as 'open' | 'resolved') : 'open';
      const incidents = listResponseIncidents(status);
      res.json({ incidents });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to list incidents' }); return;
    }
  });

  app.post('/responses/ops/incidents/:id/resolve', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const schema = z.object({
        resolvedBy: z.string().min(1),
        notes: z.string().optional(),
        disposition: z.enum(['retry', 'dismissed', 'escalated', 'manual']).optional(),
        linkedRunId: z.string().optional(),
      });
      const parsed = schema.parse(req.body ?? {});
      const incident = resolveResponseIncident({
        incidentId: id,
        resolvedBy: parsed.resolvedBy,
        notes: parsed.notes,
        disposition: parsed.disposition,
        linkedRunId: parsed.linkedRunId,
      });
      res.json({ incident: serializeIncident(incident) });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.flatten() });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to resolve incident' }); return;
    }
  });

  app.post('/responses/ops/prune', async (req, res): Promise<void> => {
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
        res.status(400).json({ error: err.flatten() });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'prune failed' }); return;
    }
  });

  app.post('/responses/ops/ui-event', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const schema = z.object({
        source: z.string().min(1),
        intent: z.string().min(1),
        metadata: z.record(z.any()).optional(),
      });
      const payload = schema.parse(req.body ?? {});
      log.info({ event: 'responses.ui_event', ...payload }, 'Responses UI interaction');
      res.json({ ok: true });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.flatten() });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to log ui event' }); return;
    }
  });

  app.post('/responses/runs/:id/retry', async (req, res): Promise<void> => {
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
        outputAudio: result.outputAudio,
        outputImages: result.outputImages,
        inputTranscripts: result.inputTranscripts,
        delegations: result.delegations,
        historyPlan: result.historyPlan,
        traceId: result.traceId,
        safety: result.safety,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.flatten() });
        return;
      }
      if (err instanceof Error && err.message === 'run not found') {
        res.status(404).json({ error: 'not found' }); return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'retry failed' }); return;
    }
  });

  app.post('/responses/runs/:id/moderation-notes', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const schema = z.object({
        reviewer: z.string().min(1),
        note: z.string().min(1),
        disposition: z.enum(['approved', 'escalated', 'blocked', 'info']),
      });
      const parsed = schema.parse(req.body ?? {});
      const note = addResponsesModeratorNote(id, {
        reviewer: parsed.reviewer,
        note: parsed.note,
        disposition: parsed.disposition,
      });
      res.status(201).json({
        note: serializeModeratorNote(note),
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.flatten() });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to record note' }); return;
    }
  });

  app.post('/responses/runs/:id/rollback', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const schema = z.object({
        sequence: z.number().int().positive().optional(),
        toolCallId: z.string().min(1).optional(),
        operator: z.string().min(1).optional(),
        reason: z.string().min(1).optional(),
      }).refine((value) => Boolean(value.sequence) || Boolean(value.toolCallId), {
        message: 'sequence or toolCallId is required',
      });
      const parsed = schema.parse(req.body ?? {});
      const snapshot = await rollbackResponsesRun(id, parsed);
      res.json(snapshot);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.flatten() });
        return;
      }
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message }); return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'rollback failed' }); return;
    }
  });

  app.post('/responses/runs/:id/export', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const location = await exportResponsesRun(id);
      res.json({ ok: true, path: location });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'export failed' }); return;
    }
  });

  app.get('/responses/runs', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    try {
      const runtime = getResponsesRuntime();
      const runs = runtime.archive.listRuns().map(serializeRun);
      res.json({ runs });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to list runs' }); return;
    }
  });

  app.get('/responses/runs/:id', async (req, res): Promise<void> => {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;
    try {
      const runtime = getResponsesRuntime();
      const timeline = runtime.archive.getTimeline(id);
      if (!timeline) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      const incidents = getRunIncidents(id);

      res.json({
        run: serializeRun(timeline.run),
        events: timeline.events.map(serializeEvent),
        bufferedMessages: runtime.coordinator.getBufferedMessages(id),
        reasoning: runtime.coordinator.getBufferedReasoning(id),
        refusals: runtime.coordinator.getBufferedRefusals(id),
        outputAudio: runtime.coordinator.getBufferedOutputAudio(id),
        outputImages: runtime.coordinator.getBufferedImages(id),
        inputTranscripts: runtime.coordinator.getBufferedInputTranscripts(id),
        delegations: runtime.coordinator.getDelegations(id),
        rateLimits: runtime.tracker.getLastSnapshot(timeline.run.metadata?.tenant_id ?? timeline.run.metadata?.tenantId),
        incidents,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to fetch run' }); return;
    }
  });
}
