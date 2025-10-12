import { log } from './logger';

function traceEnabled(): boolean {
  return (process.env.RUN_TRACE_LOG || process.env.NOFX_TRACE_LOG || '').toLowerCase() === 'true';
}

type TracePayload = Record<string, unknown> | undefined;

export function trace(event: string, payload?: TracePayload) {
  if (!traceEnabled()) return;
  const meta = payload ? { ...payload } : {};
  log.info({ trace: true, event, ...meta }, `[trace] ${event}`);
}

export function traceDebug(event: string, payload?: TracePayload) {
  if (!traceEnabled()) return;
  const meta = payload ? { ...payload } : {};
  log.debug({ trace: true, event, ...meta }, `[trace] ${event}`);
}
