import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { metrics } from './metrics';
import { log as pinoLogger } from './logger';
import type { Logger } from 'pino';

export type ObsContext = {
  requestId?: string;
  correlationId?: string;
  runId?: string;
  stepId?: string;
  provider?: string;
  retryCount?: number;
  projectId?: string;
  logger?: Logger;
};

const als = new AsyncLocalStorage<ObsContext>();

// Export a log instance that automatically includes correlation ID
export const log = new Proxy(pinoLogger, {
  get(target, prop) {
    const ctx = als.getStore();
    if (ctx?.correlationId) {
      // Return child logger with correlation ID
      return target.child({ correlationId: ctx.correlationId })[prop];
    }
    return target[prop];
  }
});

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
  const correlationId = String((req.headers['x-correlation-id'] as string) || requestId);

  // Try to correlate if known (URL params/headers/body)
  const runId = (req.params?.id as string) || (req.headers['x-run-id'] as string) || (req.body?.runId as string);
  const stepId = (req.headers['x-step-id'] as string) || (req.body?.stepId as string);

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  // Create child logger with all context
  const logger = pinoLogger.child({
    correlationId,
    requestId,
    runId,
    stepId,
    method: req.method,
    path: req.path
  });

  runWithContext({ requestId, correlationId, runId, stepId, retryCount: 0, logger }, () => {
    logger.info({ event: 'request.started' }, 'Request started');

    const finish = () => {
      const latencyMs = Date.now() - start;
      const status = res.statusCode;

      // Record metrics
      try {
        metrics.httpRequestDuration.observe({
          method: req.method,
          route: req.route?.path || req.path || 'unknown',
          status: String(status)
        }, latencyMs);
      } catch (error) {
        logger.warn({ error }, 'Failed to record metrics');
      }

      // Log request completion with full context
      logger.info({
        event: 'request.completed',
        statusCode: status,
        latencyMs
      }, 'Request completed');
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
