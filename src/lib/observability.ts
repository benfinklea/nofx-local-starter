import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { metrics } from './metrics';

export type ObsContext = {
  requestId?: string;
  runId?: string;
  stepId?: string;
  provider?: string;
  retryCount?: number;
};

const als = new AsyncLocalStorage<ObsContext>();

export function getContext(): ObsContext | undefined {
  return als.getStore();
}

export function runWithContext<T>(ctx: ObsContext, fn: () => T): T {
  return als.run({ ...ctx }, fn);
}

export function setContext(patch: Partial<ObsContext>): void {
  const s = als.getStore();
  if (!s) return;
  Object.assign(s, patch);
}

export function newRequestId(): string {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
}

// Express middleware: request ID + latency log + correlation
export function requestObservability(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = String((req.headers['x-request-id'] as string) || newRequestId());
  // Try to correlate if known (URL params/headers/body)
  const runId = (req.params?.id as string) || (req.headers['x-run-id'] as string) || (req.body?.runId as string);
  const stepId = (req.headers['x-step-id'] as string) || (req.body?.stepId as string);

  res.setHeader('x-request-id', requestId);

  runWithContext({ requestId, runId, stepId, retryCount: 0 }, () => {
    const finish = () => {
      const latencyMs = Date.now() - start;
      const status = res.statusCode;
      // Record metrics when available
      try {
        metrics.httpRequestDuration.observe({ method: req.method, route: req.route?.path || req.path || 'unknown', status: String(status) }, latencyMs);
      } catch {}
      // Avoid circular imports with logger; rely on metrics and other logs
      try { /* no-op structured request log omitted to avoid cycle */ } catch {}
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  });
}

// Helper to measure durations
export async function timeIt<T>(op: string, f: () => Promise<T>): Promise<{ result: T; latencyMs: number }>{
  const start = Date.now();
  const result = await f();
  const latencyMs = Date.now() - start;
  return { result, latencyMs };
}
