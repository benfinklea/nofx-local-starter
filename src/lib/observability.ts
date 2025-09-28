import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { metrics } from './metrics';
import pino from 'pino';
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

const baseLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

function resolveLogger(): Logger {
  const ctx = als.getStore();
  if (!ctx?.correlationId) return baseLogger;
  return baseLogger.child({ correlationId: ctx.correlationId });
}

export const log = new Proxy(baseLogger as Logger, {
  get(_target, prop, receiver) {
    const logger = resolveLogger();
    return Reflect.get(logger, prop, receiver);
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
  const logger = baseLogger.child({
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
